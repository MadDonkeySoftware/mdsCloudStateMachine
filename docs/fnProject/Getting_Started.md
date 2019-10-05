# fnProject

## Getting Started

* Setup fn and create a sample application and function
    * For more detailed instructions see [the official docs](https://fnproject.io/tutorials/).
    * `fn start` to start the development fn server
    * Configuration
        * (optional) `fn use context default` to switch to the default context if needed
        * (optional) `fn update context api-url http://localhost:8080` or a different port if needed
        * (optional) `fn update context registery fndemouser` to use the default docker registry and demo user
        * (optional) `fn list contexts` to verify your configuration
    * Create sample application and function in node (see [tutorials](https://fnproject.io/tutorials) for other langauges)
        * `fn init --runtime node nodefn` to create the default "Hello World" template
        * `fn create app nodeapp` to create the "nodeapp" application that will contain your functions
        * `fn deploy --app nodeapp --local` to deploy your function to the server
* Please note that a [sample application](https://github.com/fritogotlayed/fnStateMachine-sampleApp) is available that contains a simple testing workflow.
    * `fn deploy --all --local` can be run from the root directory. Use `fn inspect function testNodeApplication <name>` where the name is `one`, `two`, or `three` and copy the "fnproject.io/fn/invokeEndpoint" into the corresponding "Resource" field in the post body for your system.

### Other useful commands

* Listing available applications
    * `fn list apps`
* Listing functions in application
    * `fn list functions <appName>`
* Invoking a function via the CLI
    * `fn invoke <appName> <funcName>`
* Invoking a function via the HTTP Endpoint
    * `fn inspect function <appName> <funcName>` and note the "invokeEndpoint" in the JSON response.
    * `curl -X "POST" -H "Content-Type: application/json" <url>` to invoke without arguments
    * `curl -X "POST" -H "Content-Type: application/json" -d '{"name": "Globe"}' <url>` to invoke with arguments