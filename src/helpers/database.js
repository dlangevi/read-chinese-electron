// All saved data will be ran through here, so we can swap electron-store to
// something more performant later if we need
import Store from 'electron-store';
import Knex from 'knex';
import knexConfigMap from '../../knexfile';

const knexConfig = knexConfigMap[process.env.NODE_ENV];
const knex = Knex(knexConfig);

knex.migrate.latest(knexConfig).catch((err) => {
  console.log(err);
});

const bookStore = new Store({ name: 'books' });
const metadataStore = new Store({ name: 'metadata' });

export function updateTimesRan() {
  const timesRan = metadataStore.get('ran', 0);
  metadataStore.set('ran', timesRan + 1);
}

export function getTimesRan() {
  return metadataStore.get('ran', 0);
}

export function updateWord(ankiCard) {
  knex('words')
    .where('word', ankiCard.fields.Hanzi.value)
    .update({
      has_flash_card: true,
      interval: ankiCard.interval,
    }).catch((err) => { console.log(err); });
}

export function saveWords(words) {
  Object.entries(words).forEach(([word, entry]) => {
    console.log(`Inserting ${word}`);
    knex('words')
      .insert({
        word,
        interval: entry.interval,
      })
      .catch((err) => {
        console.error(err);
      });
  });
}

export async function loadWords() {
  const words = await knex('words')
    .select({ id: 'id', word: 'word' })
    .catch((error) => { console.log(error); });
  return words;
}

export function addBook(author, title, cover, filepath) {
  // For now just point to the actual txt file location in calibre. Later we will make our own copy
  const books = bookStore.get('booklist', {});
  books[`${author}-${title}`] = {
    author,
    title,
    txtFile: filepath,
    cover,
  };
  bookStore.set('booklist', books);
}

export function getBooks() {
  return Object.values(bookStore.get('booklist', {}));
}

export function getBookKey(bookKey) {
  return bookStore.get('booklist')[bookKey];
}

// For now we will use author and title to do book uniqueness
export function bookExists(author, title) {
  const books = bookStore.get('booklist', {});
  return (`${author}-${title}` in books);
}
