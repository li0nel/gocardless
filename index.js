'use strict';

const uuid = require('uuid');
const AWS = require('aws-sdk'); 

AWS.config.setPromisesDependency(require('bluebird'));

var rp = require('request-promise');

const dynamoDb = new AWS.DynamoDB.DocumentClient();

module.exports.create = (event, context, callback) => {
  const monthly_fee = parseInt(event.queryStringParameters.monthly_fee);
  const merchant_id = parseInt(event.queryStringParameters.merchant_id);
  const merchant_name = event.queryStringParameters.merchant_name;

  if (typeof monthly_fee !== 'number' || typeof merchant_id !== 'number' || typeof merchant_name !== 'string') {
    console.error('Validation Failed');
    callback(new Error('Couldn\'t create redirect flow because of validation errors.'));
    return;
  }

  createRedirectFlow(monthly_fee, merchant_id, merchant_name)
    .then(res => {
        console.log(res);
        callback(null, {
            statusCode: 302,
            headers: {
                Location: res
            }
        });
    })
    .catch(err => {
      console.log(err);
      callback(null, {
        statusCode: 500,
        body: JSON.stringify({
          message: 'Unable to create redirect flow'
        })
      })
    });
};

const createRedirectFlow = (monthly_fee, merchant_id, merchant_name) => {
  console.log('Creating Redirect Flow');

  return rp({
        method: 'POST',
        uri: 'https://api-sandbox.gocardless.com/redirect_flows',
        headers: {
            Authorization: `Bearer ${process.env.GC_TOKEN}`,
            'GoCardless-Version': '2015-07-06'
        },
        body: {
            redirect_flows: {
                success_redirect_url: "https://gocardless.wi5.io/callback",
                session_token: uuid.v1(),
                description: "Wi5 Monthly Licence Fee"
            }
        },
        json: true
    }).then(parsedBody => {
        const timestamp = new Date().getTime();
        return dynamoDb.put({
            TableName: process.env.TABLE,
            Item: {
                uuid: parsedBody.redirect_flows.session_token,
                merchant_id: merchant_id,
                merchant_name: merchant_name,
                monthly_fee: monthly_fee,
                submittedAt: timestamp,
                updatedAt: timestamp,
              },
          }).promise().then(res => {
            return parsedBody.redirect_flows.redirect_url;
        })
    })
    .catch(function (err) {
        // POST failed...
        console.log(err);
    });
};