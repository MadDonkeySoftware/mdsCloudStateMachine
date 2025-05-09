import { mockFunctionsClient, mockQueueClient } from '../../src/test-utilities';

module.exports = {
  MdsSdk: {
    getQueueServiceClient: jest
      .fn()
      .mockReturnValue(Promise.resolve(mockQueueClient)),
    getServerlessFunctionsClient: jest
      .fn()
      .mockReturnValue(Promise.resolve(mockFunctionsClient)),
  },
};
