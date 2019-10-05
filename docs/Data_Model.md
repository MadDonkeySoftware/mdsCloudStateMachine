## Data Model

* StateMachine
    * Id            [Text] - The GUID to identify the state machine
    * Name          [Text] - The friendly name for this state machine (Optional)
    * ActiveVersion [Text] - Reference to StateMachineVersion

* StateMachineVersion (versions to support updates while executions are in flight)
    * Id         [Text] - The GUID to identify the state machine
    * Definition [Text] - The state machine workflow definition

* Execution
    * Id      [Text] - The GUID to identify this execution
    * Created [Text] - The datetime this execution was created and thus started
    * Status  [Text] - The status of the state machine. [Pending, Executing, Succeeded, Failed]
    * Version [Text] - Reference to StateMachineVersion

* Operation
    * Id           [Text] - The GUID to identify this operation
    * Execution    [Text] - Reference to Execution
    * Created      [Text] - The datetime this operation was created and thus started
    * StateKey     [Text] - The unique state key for this operation as defined in the state machine definition
    * Status       [Text] - The status of the operation. [Pending, Executing, Succeeded, Failed]
    * Input        [Text] - The JSON encoded object used as input for this operation
    * InputType    [Text] - The type of data in the Input column
    * Output       [Text] - The JSON encoded object output from this operation
    * OutputType   [Text] - The type of data in the Output column
    * WaitUntilUtc [Text] - When a Wait operation is issues this is the "wake up" timestamp in ISO8601 UTC.