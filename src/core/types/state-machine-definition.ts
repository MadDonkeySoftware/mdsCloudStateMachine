// TODO: Validate against AWS Step Functions definition schema
export type BaseState = {
  Type: string;
};

export type CatchDefinition = {
  ErrorEquals?: string[];
  Next: string;
};

export type TaskState = BaseState & {
  Resource: string;
  Next: string;
  Catch: CatchDefinition[];
};

export type ChoiceState = BaseState & {
  // TODO: Support FooPath. I.e. BooleanEqualsPath: $.foo
  Choices: {
    Variable: string;
    BooleanEquals?: boolean;
    StringEquals?: string;
    NumericEquals?: number;
    TimestampEquals?: string;
    NumericGreaterThan?: number;
    StringGreaterThan?: string;
    TimestampGreaterThan?: string;
    NumericGreaterThanEquals?: number;
    StringGreaterThanEquals?: string;
    TimestampGreaterThanEquals?: string;
    NumericLessThan?: number;
    StringLessThan?: string;
    TimestampLessThan?: string;
    NumericLessThanEquals?: number;
    StringLessThanEquals?: string;
    TimestampLessThanEquals?: string;
    Next: string;
  }[];
  Default: string;
};

export type WaitState = BaseState & {
  Seconds?: number;
  Timestamp?: string;
  SecondsPath?: string;
  TimestampPath?: string;
  Next: string;
};

export type FailState = BaseState;

export type SucceedState = BaseState;

type allStates = TaskState | ChoiceState | WaitState | FailState | SucceedState;

export type StateMachineDefinition = {
  Name: string;
  StartAt: string;
  States: Record<string, allStates>;
};
