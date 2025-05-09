import config from 'config';
import { generate } from '@maddonkeysoftware/orid-node/v1';

export function makeOrid({
  resourceId,
  accountId,
  rider,
}: {
  resourceId: string;
  accountId: string;
  rider?: string;
}): string {
  const provider = config.get<string>('oridProviderKey');
  const service = 'sm';
  return generate({
    provider,
    service,
    resourceId,
    custom3: accountId,
    resourceRider: rider,
    useSlashSeparator: true,
  });
}
