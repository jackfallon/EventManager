import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as location from 'aws-cdk-lib/aws-location';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';

export class EventManagementStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPC
    const vpc = new ec2.Vpc(this, 'EventVPC', {
      maxAzs: 2,
      natGateways: 1,
    });

    // RDS Instance
    const dbSecurityGroup = new ec2.SecurityGroup(this, 'DBSecurityGroup', {
      vpc,
      description: 'Security group for RDS instance',
      allowAllOutbound: true,
    });

    const database = new rds.DatabaseInstance(this, 'EventDatabase', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_13,
      }),
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE3, ec2.InstanceSize.MICRO),
      securityGroups: [dbSecurityGroup],
      databaseName: 'eventdb',
      credentials: rds.Credentials.fromGeneratedSecret('postgres'),
    });

    // Cognito User Pool
    const userPool = new cognito.UserPool(this, 'EventUserPool', {
      userPoolName: 'event-user-pool',
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
        phone: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
        phoneNumber: {
          required: true,
          mutable: true,
        },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
    });

    const userPoolClient = userPool.addClient('EventWebClient', {
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
    });


    // SNS Topic
    const eventTopic = new sns.Topic(this, 'EventNotificationTopic');

    // Location Service
    const placeIndex = new location.CfnPlaceIndex(this, 'EventPlaceIndex', {
      dataSource: 'Here',
      indexName: 'event-location-index',
      pricingPlan: 'RequestBasedUsage',
    });

    // Lambda Layer for shared code
    const sharedLayer = new lambda.LayerVersion(this, 'SharedLayer', {
      code: lambda.Code.fromAsset('backend/layers/shared'),
      compatibleRuntimes: [lambda.Runtime.NODEJS_18_X],
    });

    // Lambda Functions
    const lambdaRole = new iam.Role(this, 'LambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    });
    
    lambdaRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole')
    );

    const createEventFunction = new lambda.Function(this, 'CreateEventFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'createEvent.handler',
      code: lambda.Code.fromAsset('backend/src/handlers'),
      vpc,
      layers: [sharedLayer],
      role: lambdaRole,
      environment: {
        DB_SECRET_ARN: database.secret?.secretArn || '',
        SNS_TOPIC_ARN: eventTopic.topicArn,
        PLACE_INDEX_NAME: placeIndex.indexName,
      },
    });

    const getEventsFunction = new lambda.Function(this, 'GetEventsFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'getEvents.handler',
      code: lambda.Code.fromAsset('backend/src/handlers'),
      vpc,
      layers: [sharedLayer],
      role: lambdaRole,
      environment: {
        DB_SECRET_ARN: database.secret?.secretArn || '',
      },
    });

    // API Gateway
    const api = new apigateway.RestApi(this, 'EventApi', {
      restApiName: 'Event Service',
      description: 'API for event management',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'EventAuthorizer', {
      cognitoUserPools: [userPool],
    });

    const events = api.root.addResource('events');
    
    events.addMethod('POST', new apigateway.LambdaIntegration(createEventFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    events.addMethod('GET', new apigateway.LambdaIntegration(getEventsFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Frontend hosting
    const siteBucket = new s3.Bucket(this, 'SiteBucket', {
      websiteIndexDocument: 'index.html',
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    const distribution = new cloudfront.Distribution(this, 'SiteDistribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
      ],
    });

    new s3deploy.BucketDeployment(this, 'DeployWebsite', {
      sources: [s3deploy.Source.asset('../frontend/dist')],
      destinationBucket: siteBucket,
      distribution,
      distributionPaths: ['/*'],
    });

    // Outputs
    new cdk.CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
    new cdk.CfnOutput(this, 'UserPoolClientId', { value: userPoolClient.userPoolClientId });
    new cdk.CfnOutput(this, 'ApiUrl', { value: api.url });
    new cdk.CfnOutput(this, 'WebsiteUrl', { value: `https://${distribution.domainName}` });
  }
}
