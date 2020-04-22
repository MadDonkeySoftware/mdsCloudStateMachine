## NOTES

* https://github.com/fnproject
* Actions
    * create a new state machine
    * invoke a state machine
    * update the flow of a state machine
    * delete a state machine
    * list available state machine
    * list executions for a state machine
    * list list steps for a state machine
* Available state machine States
    * [Pass](https://docs.aws.amazon.com/step-functions/latest/dg/amazon-states-language-pass-state.html)
    * [Task](https://docs.aws.amazon.com/step-functions/latest/dg/amazon-states-language-task-state.html)
    * [Choice](https://docs.aws.amazon.com/step-functions/latest/dg/amazon-states-language-choice-state.html)
    * [Wait](https://docs.aws.amazon.com/step-functions/latest/dg/amazon-states-language-wait-state.html)
    * [Succeed](https://docs.aws.amazon.com/step-functions/latest/dg/amazon-states-language-succeed-state.html)
    * [Fail](https://docs.aws.amazon.com/step-functions/latest/dg/amazon-states-language-fail-state.html)
    * [Parallel](https://docs.aws.amazon.com/step-functions/latest/dg/amazon-states-language-parallel-state.html)
    * [Map](https://docs.aws.amazon.com/step-functions/latest/dg/amazon-states-language-map-state.html)
* Run data should be as short lived as possible
    * I.e. executions and child data should be evicted from the system on a short regular schedule
        * Ex: between 1 and 30 days. Ideally evicted after shipping to logging store
    * The intent here is for operators to house logs and other such data in a more robust logging store

## Technologies

* Used by fnProject
    * [Databases](https://github.com/fnproject/docs/blob/master/fn/operate/databases/README.md)
        * sqlite3 (default)
    * [Message Queues](https://github.com/fnproject/docs/blob/master/fn/operate/message-queues.md)
        * Bolt is golang specific, Alternative needed.
* Possible Candidates
    * https://github.com/weyoss/redis-smq
