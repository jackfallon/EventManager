import { Amplify } from 'aws-amplify';
import { cognitoUserPoolsTokenProvider } from 'aws-amplify/auth/cognito';
import config from './aws-exports';

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: config.aws_user_pools_id,
      userPoolClientId: config.aws_user_pools_web_client_id,
      identityPoolId: config.aws_cognito_identity_pool_id,
      signUpVerificationMethod: 'code',
    }
  },
  API: {
    REST: {
      eventsApi: {
        endpoint: config.aws_cloud_logic_custom[0].endpoint,
        region: config.aws_project_region,
        defaults: {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      }
    }
  }
});

cognitoUserPoolsTokenProvider.setKeyValueStorage(window.localStorage);