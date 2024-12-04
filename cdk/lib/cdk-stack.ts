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
      natGateways: 0,  
      subnetConfiguration: [
        {
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        }
      ]
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

    // Frontend hosting
    const siteBucket = new s3.Bucket(this, 'SiteBucket', {
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'index.html',
      publicReadAccess: true,
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: false,
        blockPublicPolicy: false,
        ignorePublicAcls: false,
        restrictPublicBuckets: false
      }),
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'OriginAccessIdentity');
    siteBucket.grantRead(originAccessIdentity);

    const distribution = new cloudfront.Distribution(this, 'SiteDistribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(siteBucket, {
          originAccessIdentity
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(0)
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(0)
        }
      ]
    });

    // Cognito User Pool
    const userPool = new cognito.UserPool(this, 'EventUserPool', {
      userPoolName: 'event-user-pool',
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
        phoneNumber: {
          required: false,
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
      oAuth: {
        flows: {
          implicitCodeGrant: true
        },
        scopes: [cognito.OAuthScope.EMAIL, cognito.OAuthScope.OPENID, cognito.OAuthScope.PROFILE],
        callbackUrls: ['http://localhost:5173/', 'https://' + distribution.domainName + '/']
      },
      accessTokenValidity: cdk.Duration.minutes(60),
      idTokenValidity: cdk.Duration.minutes(60),
      authFlows: {
        adminUserPassword: true,
        userPassword: true,
        userSrp: true
      }
    });

    // Create Cognito Identity Pool
    const identityPool = new cognito.CfnIdentityPool(this, 'EventIdentityPool', {
      identityPoolName: 'EventManagementIdentityPool',
      allowUnauthenticatedIdentities: false,
      cognitoIdentityProviders: [
        {
          clientId: userPoolClient.userPoolClientId,
          providerName: userPool.userPoolProviderName,
          serverSideTokenCheck: true
        },
      ],
    });

    // Create roles for authenticated users
    const authenticatedRole = new iam.Role(this, 'CognitoAuthenticatedRole', {
      assumedBy: new iam.FederatedPrincipal(
        'cognito-identity.amazonaws.com',
        {
          StringEquals: {
            'cognito-identity.amazonaws.com:aud': identityPool.ref,
          },
          'ForAnyValue:StringLike': {
            'cognito-identity.amazonaws.com:amr': 'authenticated',
          },
        },
        'sts:AssumeRoleWithWebIdentity'
      ),
    });

    // Add API Gateway permissions to the authenticated role
    authenticatedRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['execute-api:Invoke'],
        resources: [
          `arn:aws:execute-api:${this.region}:${this.account}:*/*/*`
        ],
      })
    );

    // Attach roles to identity pool
    new cognito.CfnIdentityPoolRoleAttachment(this, 'IdentityPoolRoleAttachment', {
      identityPoolId: identityPool.ref,
      roles: {
        authenticated: authenticatedRole.roleArn,
      },
    });

    // Location Service
    const placeIndex = new location.CfnPlaceIndex(this, 'EventPlaceIndex', {
      dataSource: 'Here',
      indexName: 'eventLocationIndex',
      pricingPlan: 'RequestBasedUsage',
      dataSourceConfiguration: {
        intendedUse: 'SingleUse'
      },
      description: 'Place index for event locations'
    });

    // Add Cognito Identity permissions
    authenticatedRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'cognito-identity:GetCredentialsForIdentity',
          'cognito-identity:GetId',
        ],
        resources: ['*']
      })
    );

    // SNS Topic
    const eventTopic = new sns.Topic(this, 'EventNotificationTopic');

    // Lambda Layer for shared code
    const sharedLayer = new lambda.LayerVersion(this, 'SharedLayer', {
      code: lambda.Code.fromAsset('../backend/layers/shared'),
      compatibleRuntimes: [lambda.Runtime.NODEJS_18_X],
      description: 'Shared utilities for Lambda functions',
    });

    // Lambda Functions
    const lambdaRole = new iam.Role(this, 'LambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
      ]
    });

    // Add permissions for Location Service
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'geo:SearchPlaceIndexForText',
        'geo:SearchPlaceIndexForPosition',
        'geo:GetPlace'
      ],
      resources: [placeIndex.attrArn]
    }));

    // Add permissions for RDS
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'rds-db:connect',
        'secretsmanager:GetSecretValue'
      ],
      resources: [
        database.secret?.secretArn || '*',
        `arn:aws:rds-db:${this.region}:${this.account}:dbuser:*/*`
      ]
    }));

    const createEventFunction = new lambda.Function(this, 'CreateEventFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'createEvent.handler',
      code: lambda.Code.fromAsset('../backend/src/handlers'),
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
      code: lambda.Code.fromAsset('../backend/src/handlers'),
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
      },
      layers: [sharedLayer],
      role: lambdaRole,
      environment: {
        DB_SECRET_ARN: database.secret?.secretArn || '',
        PLACE_INDEX_NAME: placeIndex.indexName,
      },
      timeout: cdk.Duration.seconds(30)
    });

    // API Gateway
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'EventAuthorizer', {
      cognitoUserPools: [userPool],
      identitySource: 'method.request.header.Authorization'
    });

    const api = new apigateway.RestApi(this, 'EventApi', {
      restApiName: 'Event Service',
      defaultCorsPreflightOptions: {
        allowOrigins: [
          'http://localhost:5173',
          `https://${distribution.domainName}`,
        ],
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token',
          'X-Amz-User-Agent',
          'Access-Control-Allow-Origin',
          'Access-Control-Allow-Headers',
          'Access-Control-Allow-Methods'
        ],
        allowCredentials: true
      }
    });

    const eventsIntegration = new apigateway.LambdaIntegration(getEventsFunction, {
      proxy: false,
      integrationResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': `'https://${distribution.domainName}'`,
            'method.response.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
            'method.response.header.Access-Control-Allow-Methods': "'GET,OPTIONS'"
          },
          responseTemplates: {
            'application/json': ''
          }
        },
        {
          selectionPattern: '.*',
          statusCode: '500',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': `'https://${distribution.domainName}'`
          },
          responseTemplates: {
            'application/json': JSON.stringify({ message: 'Internal server error' })
          }
        }
      ],
      requestTemplates: {
        'application/json': JSON.stringify({
          latitude: "$input.params('latitude')",
          longitude: "$input.params('longitude')",
          radius: "$input.params('radius')"
        })
      }
    });

    const createEventIntegration = new apigateway.LambdaIntegration(createEventFunction, {
      proxy: true,
      integrationResponses: [
        {
          statusCode: '201',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': `'https://${distribution.domainName}'`,
            'method.response.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
            'method.response.header.Access-Control-Allow-Methods': "'POST,OPTIONS'",
            'method.response.header.Access-Control-Allow-Credentials': "'true'"
          }
        },
        {
          selectionPattern: '.*',
          statusCode: '500',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': `'https://${distribution.domainName}'`,
            'method.response.header.Access-Control-Allow-Credentials': "'true'"
          }
        }
      ]
    });

    const events = api.root.addResource('events');

    events.addMethod('POST', createEventIntegration, {
      authorizationType: apigateway.AuthorizationType.COGNITO,
      authorizer: authorizer,
      methodResponses: [
        {
          statusCode: '201',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
            'method.response.header.Access-Control-Allow-Headers': true,
            'method.response.header.Access-Control-Allow-Methods': true,
            'method.response.header.Access-Control-Allow-Credentials': true
          }
        },
        {
          statusCode: '500',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
            'method.response.header.Access-Control-Allow-Credentials': true
          }
        }
      ]
    });

    events.addMethod('GET', eventsIntegration, {
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
            'method.response.header.Access-Control-Allow-Headers': true,
            'method.response.header.Access-Control-Allow-Methods': true
          }
        },
        {
          statusCode: '500',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true
          }
        }
      ]
    });

    // Deploy frontend
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
    new cdk.CfnOutput(this, 'IdentityPoolId', { value: identityPool.ref, description: 'Identity Pool ID' });
    new cdk.CfnOutput(this, 'LocationIndexName', { value: placeIndex.indexName });
  }
}
