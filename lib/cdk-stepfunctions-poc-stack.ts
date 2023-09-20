import * as stepFuntion from 'aws-cdk-lib/aws-stepfunctions';
import * as stepFunctionsTasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamo from 'aws-cdk-lib/aws-dynamodb';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { join } from 'path';

export class CdkStepfunctionsPocStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    var logGroup = new logs.LogGroup(this, 'LogGroup');

    const myTable = new dynamo.Table(this, 'Sales', {
      partitionKey: { name: 'id', type: dynamo.AttributeType.STRING },
    });

    const salesSubmitLambda = new NodejsFunction(this, 'SalesSubmitLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'handler',
      entry: (join(__dirname, 'lambda', 'submit.ts')),
    });

    const salesGetStatusLambda = new NodejsFunction(this, 'SalesGetStatusLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'handler',
      entry: (join(__dirname, 'lambda', 'getStatus.ts')),
    });

    const salesSubmitLambdaInvoke = new stepFunctionsTasks.LambdaInvoke(this, 'SalesSubmitLambdaInvoke', {
      lambdaFunction: salesSubmitLambda,
      outputPath: '$',
      resultPath: '$.guid',
    });

    const salesGetStatusLambdaInvoke = new stepFunctionsTasks.LambdaInvoke(this, 'SalesGetStatusLambdaInvoke', {
      lambdaFunction: salesGetStatusLambda,
      outputPath: '$',
      resultPath: '$.status',
    });

    const submitJob = new stepFuntion.StateMachine(this, 'SalesSubmitJob', {
      stateMachineName: 'SalesSubmitJob',
      stateMachineType: stepFuntion.StateMachineType.EXPRESS,
      definition: salesSubmitLambdaInvoke,
      logs: {
        destination: logGroup,
        level: stepFuntion.LogLevel.ALL
      }
    });

    const getStatus = new stepFuntion.StateMachine(this, 'SalesGetJobStatus', {
      stateMachineName: 'SalesGetJobStatus',
      stateMachineType: stepFuntion.StateMachineType.EXPRESS,
      definition: salesGetStatusLambdaInvoke,
      logs: {
        destination: logGroup,
        level: stepFuntion.LogLevel.ALL
      }
    });

    const wait = new stepFuntion.Wait(this, 'Wait', {
      time: stepFuntion.WaitTime.secondsPath('$.waitSeconds')
    });

    const jobFailed = new stepFuntion.Fail(this, 'JobFailed', {
      cause: 'Job Failed',
      error: 'Error description'
    });

    const salesFinalStatus = new stepFuntion.StateMachine(this, 'SalesFinalStatus', {
      stateMachineName: 'SalesFinalStatus',
      stateMachineType: stepFuntion.StateMachineType.EXPRESS,
      definition: salesGetStatusLambdaInvoke,
      logs: {
        destination: logGroup,
        level: stepFuntion.LogLevel.ALL
      }
    });

    const putItemInTable = new stepFuntion.StateMachine(this, 'PutItemInTable', {
      stateMachineName: 'PutItemInTable',
      stateMachineType: stepFuntion.StateMachineType.EXPRESS,
      definition: new stepFunctionsTasks.DynamoPutItem(this, 'DynamoPutItem', {
        item: {
          /*
          Rewrite the code below to CDK V2 or so

          "RequestId": new DynamoDynamicAttributeValue().withDynamicS('$.guid.SdkHttpMetadata.HttpHeaders.x-amzn-RequestId'),
          "TraceId": new DynamoDynamicAttributeValue().withDynamicS('$.guid.SdkHttpMetadata.HttpHeaders.X-amzn-Trace-Id'),
          "Status": new DynamoDynamicAttributeValue().withDynamicS('$.status.Payload')
          */
        },
        table: myTable,
        inputPath: '$',
        resultPath: '$.ddb'
      })
    });

    /*
      Rewrite the code below to CDK V2 or so
      
      putItemInTable.next(salesFinalStatus)

      const definition = submitJob
        .next(wait)
        .next(getStatus)
        .next(new stepFunction.Choice(this, 'IsJobComplete')
          .when(stepFuntion.Condition.stringEquals('$.status.Payload', 'FAILED'), jobFailed)
          .when(stepFuntion.Condition.stringEquals('$.status.Payload', 'SUCCEEDED'), putItemInTable)
          .otherwise(wait));
      
      new stepFuntion.StateMachine(this, 'StateMachine', {
        definition,
        timeout: Duration.minutes(5)
      });
    */
  }
}

export class DynamoDynamicAttributeValue { // From repo: extends DynamoAttributeValue
  private dynamicAttributeValue: any = {};

  public withDynamicS(value: any) {
    this.dynamicAttributeValue.S = value;
    return this;
  }
}
