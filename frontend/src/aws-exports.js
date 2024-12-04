const awsmobile = {
    "aws_project_region": "us-east-1",
    "aws_cognito_region": "us-east-1",
    "aws_user_pools_id": "us-east-1_KrZ15YwDQ",
    "aws_user_pools_web_client_id": "3b74sc9rb2o9o7hordkrgef80b",
    "aws_cognito_identity_pool_id": "us-east-1:06546bd8-9ea9-4eae-a372-160512b26988",
    "aws_mandatory_sign_in": "enable",
    "aws_appsync_graphqlEndpoint": "https://a7tj5alr5j.execute-api.us-east-1.amazonaws.com/prod/",
    "aws_appsync_region": "us-east-1",
    "aws_appsync_authenticationType": "AMAZON_COGNITO_USER_POOLS",
    "aws_cloud_logic_custom": [
        {
            "name": "eventsApi",
            "endpoint": "https://a7tj5alr5j.execute-api.us-east-1.amazonaws.com/prod/",
            "region": "us-east-1"
        }
    ],
    "geo": {
        "amazon_location_service": {
            "region": "us-east-1",
            "maps": {
                "items": {
                    "default": {
                        "style": "VectorEsriStreets"
                    }
                },
                "default": "default"
            },
            "search_indices": {
                "items": ["event-location-index"],
                "default": "event-location-index"
            }
        }
    }
};

export default awsmobile;
