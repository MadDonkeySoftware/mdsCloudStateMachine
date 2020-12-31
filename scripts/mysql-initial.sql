DROP TABLE IF EXISTS `mds-sm`.`Operation`;
DROP TABLE IF EXISTS `mds-sm`.`Execution`;
DROP TABLE IF EXISTS `mds-sm`.`StateMachine`;
DROP TABLE IF EXISTS `mds-sm`.`StateMachineVersion`;

CREATE TABLE IF NOT EXISTS `mds-sm`.`StateMachineVersion` (
    id         CHAR(36) PRIMARY KEY,
    definition TEXT     NOT NULL
);

CREATE TABLE IF NOT EXISTS `mds-sm`.`StateMachine` (
    id             CHAR(36)     PRIMARY KEY,
    account_id     VARCHAR(255) NOT NULL,
    name           VARCHAR(255) NOT NULL,
    active_version CHAR(36)     NOT NULL,
    is_deleted     TINYINT(1)   NOT NULL,
  FOREIGN KEY (active_version) REFERENCES `mds-sm`.`StateMachineVersion` (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS `mds-sm`.`Execution` (
    id      CHAR(36)     PRIMARY KEY,
    created CHAR(24)     NOT NULL,
    status  VARCHAR(255) NOT NULL,
    version CHAR(36)     NOT NULL,
  FOREIGN KEY (version) REFERENCES `mds-sm`.`StateMachineVersion` (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS `mds-sm`.`Operation` (
    id           CHAR(36)     PRIMARY KEY,
    execution    CHAR(36)     NOT NULL,
    created      CHAR(24)     NOT NULL,
    stateKey     VARCHAR(255) NOT NULL,
    status       VARCHAR(255) NOT NULL,
    input        TEXT,
    inputType    VARCHAR(50),
    output       TEXT,
    outputType   VARCHAR(50),
    waitUntilUtc CHAR(36),
  FOREIGN KEY (execution) REFERENCES `mds-sm`.`Execution` (id) ON DELETE CASCADE
);