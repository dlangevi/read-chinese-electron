import { ImageSearchClient } from '@azure/cognitiveservices-imagesearch';
import { CognitiveServicesCredentials } from '@azure/ms-rest-azure-js';
import { getOptionValue } from './database';
// replace this value with your valid subscription key.

async function getImagesForWord(word) {
  const imageSearchKey = getOptionValue('AzureImageApiKey');
  const imageSearchEndPoint = 'https://api.bing.microsoft.com/v7.0/images/search';
  const cognitiveServiceCredentials = new CognitiveServicesCredentials(
    imageSearchKey,
  );
  const client = new ImageSearchClient(cognitiveServiceCredentials, {
    endpoint: imageSearchEndPoint,
  });

  const options = {
    // color: 'Monochrome',
    count: 5,
    imageType: 'Photo',
    safeSearch: 'Strict',
  };
  return client.images
    .search(word, options)
    .then((result) => result.value);
}

export const imageSearchIpc = { getImagesForWord };
