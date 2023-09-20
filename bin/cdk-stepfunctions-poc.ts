#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { CdkStepfunctionsPocStack } from '../lib/cdk-stepfunctions-poc-stack';

const app = new cdk.App();
new CdkStepfunctionsPocStack(app, 'CdkStepfunctionsPocStack', {
  env: {
    account: '104816988238',
    region: 'us-east-2',
  },
});
