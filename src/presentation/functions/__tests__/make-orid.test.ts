import { makeOrid } from '../make-orid';
import config from 'config';

describe('make-orid', () => {
  it('Returns ORID with correct format without rider', async () => {
    // Arrange
    const resourceId = 'resourceId';
    const accountId = 'accountId';
    const issuer = config.get<string>('oridProviderKey');

    // Act
    const result = makeOrid({
      resourceId,
      accountId,
    });

    // Assert
    expect(result).toEqual(`orid:1:${issuer}:::${accountId}:sm:${resourceId}`);
  });

  it('Returns ORID with correct format with rider', async () => {
    // Arrange
    const resourceId = 'resourceId';
    const accountId = 'accountId';
    const rider = 'rider';
    const issuer = config.get<string>('oridProviderKey');

    // Act
    const result = makeOrid({
      resourceId,
      accountId,
      rider,
    });

    // Assert
    expect(result).toEqual(
      `orid:1:${issuer}:::${accountId}:sm:${resourceId}/${rider}`,
    );
  });
});
