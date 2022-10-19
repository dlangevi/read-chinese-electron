import type {
  Book,
} from '@/shared/types';
import {
  initBookStats,
} from '@/shared/types';
import { isKnown, isKnownChar } from './knownWords';
import { loadJieba } from './segmentation';
import { getDefaultDefinition, getPinyin } from './dictionaries';
import {
  dbGetBooks, dbGetBookById, dbAddBook, dbBookExists, dbSaveWordTable,
  dbGetBook, knex,
} from './database';

export async function getBooks(bookIds?: number[]) {
  return dbGetBooks(bookIds);
}

export async function addBook(
  author:string,
  title:string,
  cover:string,
  filepath:string,
) {
  const inserted = await dbAddBook(author, title, cover, filepath);
  if (inserted) {
    const book = await dbGetBook(author, title);
    const wordTable = await computeWordTable(book);
    await dbSaveWordTable(book, wordTable);
  }
}
export async function bookExists(author:string, title:string) {
  return dbBookExists(author, title);
}

async function computeBookData(book:Book) {
  // compute at runtime stuff I dont want to save right now
  await computeStats(book);
}

async function computeExtraData(book:Book) {
  return knex<{ word:string, occurance:number }[]>('frequency')
    .select('word')
    .sum({ occurance: 'count' })
    .where('book', book.bookId)
    .groupBy('word')
    .then((rows) => {
      let probablyKnownWords = 0;
      let knownCharacters = 0;
      let totalCharacters = 0;
      rows.forEach(({ word, occurance }) => {
        totalCharacters += word.length * occurance;
        let allKnown = true;
        const charArray:string[] = Array.from(word);
        charArray.forEach((char:string) => {
          if (isKnownChar(char)) {
            knownCharacters += occurance;
          } else {
            allKnown = false;
          }
        });
        if (isKnown(word) || allKnown) {
          probablyKnownWords += occurance;
        }
      });

      book.stats.probablyKnownWords = probablyKnownWords;
      book.stats.knownCharacters = knownCharacters;
      book.stats.totalCharacters = totalCharacters;
    });
}

async function computeWordTargets(book:Book) {
  const top = await knex('frequency')
    .select('word')
    .select('count')
    .where('book', book.bookId)
    .whereNotExists(function wordTable() {
      this.select('word')
        .from('words')
        .whereRaw('words.word==frequency.word');
    })
    .orderBy('count', 'desc');

  const targets = [
    80, 84, 86, 90, 92, 94, 96, 98, 100,
  ];
  const targetOccurances = targets.map(
    (target) => (target / 100) * book.stats.totalWords,
  );
  const needToKnow = targetOccurances.map(
    (targetOccurance) => {
      let soFar = book.stats.totalKnownWords;
      let needToLearn = 0;
      // I actually do need a loop here so I can short circut
      for (const entry of top) { // eslint-disable-line no-restricted-syntax
        if (soFar > targetOccurance) {
          break;
        }
        soFar += entry.count;
        needToLearn += 1;
      }
      return needToLearn;
    },
  );
  book.stats.targets = targets;
  book.stats.targetOccurances = targetOccurances;
  book.stats.needToKnow = needToKnow;
}

async function loadBook(bookId:number) {
  const book = await dbGetBookById(bookId);
  book.stats = initBookStats();
  await computeBookData(book);
  await computeExtraData(book);
  await computeWordTargets(book);
  return book;
}

async function deleteBook(bookId:number) {
  await knex('books').where('bookId', bookId).del();
  await knex('frequency').where('book', bookId).del();
}

async function computeWordTable(book:Book) {
  console.log(`computing wordtable for ${book.filepath}`);
  const segText = await loadJieba(book);
  const wordTable:{
    [key:string]: number;
  } = {};
  segText.forEach((sentence) => {
    sentence.forEach(([word, type]) => {
      if (type !== 3) return;
      if (word in wordTable) {
        wordTable[word] += 1;
      } else {
        wordTable[word] = 1;
      }
    });
  });
  return wordTable;
}

async function computeStats(book:Book) {
  book.stats.totalKnownWords = await knownWords(book);
  book.stats.totalWords = await allWords(book);
}

// This is where I get tripped up on the seperation layer. This is a db
// specific operation
export async function topWords(bookIds?:number[]) {
  const top = knex<{ word:string, occurance:number }[]>('frequency')
    .select('word')
    .sum({ occurance: 'count' })
    .whereNotExists(function wordTable() {
      this.select('word')
        .from('words')
        .whereRaw('words.word==frequency.word');
    })
    .groupBy('word')
    .orderBy('occurance', 'desc')
    .limit(200);

  if (bookIds !== undefined && bookIds.length > 0) {
    top.whereIn('book', bookIds);
  }

  const results = await top;

  return results.map((row) => {
    row.definition = getDefaultDefinition(row.word);
    row.pinyin = getPinyin(row.word);
    return row;
  });
}

async function hskWords() {
  const words = [
    '爱情',
    '安排',
    '安全',
    '按时',
    '按照',
    '百分之',
    '棒',
    '包子',
    '保护',
    '保证',
    '报名',
    '抱',
    '抱歉',
    '倍',
    '本来',
    '笨',
    '比如',
    '毕业',
    '遍',
    '标准',
    '表格',
    '表示',
    '表演',
    '表扬',
    '饼干',
    '并且',
    '博士',
    '不得不',
    '不管',
    '不过',
    '不仅',
    '部分',
    '擦',
    '猜',
    '材料',
    '参观',
    '餐厅',
    '厕所',
    '差不多',
    '长城',
    '长江',
    '尝',
    '场',
    '超过',
    '成功',
    '成为',
    '诚实',
    '乘坐',
    '吃惊',
    '重新',
    '抽烟',
    '出差',
    '出发',
    '出生',
    '出现',
    '厨房',
    '传真',
    '窗户',
    '词语',
    '从来',
    '粗心',
    '存',
    '错误',
    '答案',
    '打扮',
    '打扰',
    '打印',
    '打招呼',
    '打折',
    '打针',
    '大概',
    '大使馆',
    '大约',
    '大夫',
    '戴',
    '当',
    '当时',
    '刀',
    '导游',
    '到处',
    '到底',
    '倒',
    '道歉',
    '得意',
    '得',
    '登机牌',
    '等',
    '低',
    '底',
    '地点',
    '地球',
    '地址',
    '调查',
    '掉',
    '丢',
    '动作',
    '堵车',
    '肚子',
    '短信',
    '对话',
    '对面',
    '对于',
    '儿童',
    '而',
    '发生',
    '发展',
    '法律',
    '翻译',
    '烦恼',
    '反对',
    '方法',
    '方面',
    '方向',
    '房东',
    '放弃',
    '放暑假',
    '放松',
    '份',
    '丰富',
    '否则',
    '符合',
    '父亲',
    '付款',
    '负责',
    '复印',
    '复杂',
    '富',
    '改变',
    '干杯',
    '赶',
    '敢',
    '感动',
    '感觉',
    '感情',
    '感谢',
    '干',
    '刚',
    '高速公路',
    '胳膊',
    '各',
    '工资',
    '公里',
    '功夫',
    '共同',
    '购物',
    '够',
    '估计',
    '鼓励',
    '故意',
    '顾客',
    '挂',
    '关键',
    '观众',
    '管理',
    '光',
    '广播',
    '广告',
    '逛',
    '规定',
    '国籍',
    '国际',
    '果汁',
    '过程',
    '海洋',
    '害羞',
    '寒假',
    '汗',
    '航班',
    '好处',
    '好像',
    '号码',
    '合格',
    '合适',
    '盒子',
    '后悔',
    '厚',
    '互联网',
    '互相',
    '护士',
    '怀疑',
    '回忆',
    '活动',
    '活泼',
    '火',
    '获得',
    '积极',
    '积累',
    '基础',
    '激动',
    '及时',
    '即使',
    '计划',
    '记者',
    '技术',
    '既然',
    '继续',
    '寄',
    '加班',
    '加油站',
    '家具',
    '假',
    '价格',
    '坚持',
    '减肥',
    '减少',
    '建议',
    '将来',
    '奖金',
    '降低',
    '降落',
    '交',
    '交流',
    '交通',
    '郊区',
    '骄傲',
    '饺子',
    '教授',
    '教育',
    '接受',
    '接着',
    '节',
    '节约',
    '结果',
    '解释',
    '尽管',
    '紧张',
    '进行',
    '禁止',
    '京剧',
    '经济',
    '经历',
    '经验',
    '精彩',
    '景色',
    '警察',
    '竞争',
    '竟然',
    '镜子',
    '究竟',
    '举',
    '举办',
    '举行',
    '拒绝',
    '距离',
    '聚会',
    '开玩笑',
    '开心',
    '看法',
    '考虑',
    '烤鸭',
    '科学',
    '棵',
    '咳嗽',
    '可怜',
    '可是',
    '可惜',
    '客厅',
    '肯定',
    '空',
    '空气',
    '恐怕',
    '苦',
    '矿泉水',
    '困',
    '困难',
    '垃圾桶',
    '拉',
    '辣',
    '来不及',
    '来得及',
    '来自',
    '懒',
    '浪费',
    '浪漫',
    '老虎',
    '冷静',
    '礼拜天',
    '礼貌',
    '理发',
    '理解',
    '理想',
    '力气',
    '厉害',
    '例如',
    '俩',
    '连',
    '联系',
    '凉快',
    '零钱',
    '另外',
    '留',
    '流利',
    '流行',
    '旅行',
    '律师',
    '乱',
    '麻烦',
    '马虎',
    '满',
    '毛',
    '毛巾',
    '美丽',
    '梦',
    '迷路',
    '密码',
    '免费',
    '秒',
    '民族',
    '母亲',
    '目的',
    '耐心',
    '难道',
    '难受',
    '内',
    '内容',
    '能力',
    '年龄',
    '弄',
    '暖和',
    '偶尔',
    '排队',
    '排列',
    '判断',
    '陪',
    '批评',
    '皮肤',
    '脾气',
    '篇',
    '骗',
    '乒乓球',
    '平时',
    '破',
    '葡萄',
    '普遍',
    '普通话',
    '其次',
    '其中',
    '气候',
    '千万',
    '签证',
    '敲',
    '桥',
    '巧克力',
    '亲戚',
    '轻',
    '轻松',
    '情况',
    '穷',
    '区别',
    '取',
    '全部',
    '缺点',
    '缺少',
    '却',
    '确实',
    '然而',
    '热闹',
    '任何',
    '任务',
    '扔',
    '仍然',
    '日记',
    '入口',
    '散步',
    '森林',
    '沙发',
    '伤心',
    '商量',
    '稍微',
    '勺子',
    '社会',
    '申请',
    '深',
    '甚至',
    '生活',
    '生命',
    '生意',
    '省',
    '剩',
    '失败',
    '失望',
    '师傅',
    '十分',
    '实际',
    '实在',
    '使',
    '使用',
    '世纪',
    '是否',
    '适合',
    '适应',
    '收',
    '收入',
    '收拾',
    '首都',
    '首先',
    '受不了',
    '受到',
    '售货员',
    '输',
    '熟悉',
    '数量',
    '数字',
    '帅',
    '顺便',
    '顺利',
    '顺序',
    '说明',
    '硕士',
    '死',
    '速度',
    '塑料袋',
    '酸',
    '随便',
    '随着',
    '孙子',
    '所有',
    '台',
    '抬',
    '态度',
    '谈',
    '弹钢琴',
    '汤',
    '糖',
    '躺',
    '趟',
    '讨论',
    '讨厌',
    '特点',
    '提',
    '提供',
    '提前',
    '提醒',
    '填空',
    '条件',
    '停',
    '挺',
    '通过',
    '通知',
    '同情',
    '同时',
    '推',
    '推迟',
    '脱',
    '袜子',
    '完全',
    '网球',
    '网站',
    '往往',
    '危险',
    '卫生间',
    '味道',
    '温度',
    '文章',
    '污染',
    '无',
    '无聊',
    '无论',
    '误会',
    '西红柿',
    '吸引',
    '咸',
    '现金',
    '羡慕',
    '相反',
    '相同',
    '香',
    '详细',
    '响',
    '橡皮',
    '消息',
    '小吃',
    '小伙子',
    '小说',
    '笑话',
    '效果',
    '心情',
    '辛苦',
    '信封',
    '信息',
    '信心',
    '兴奋',
    '行',
    '醒',
    '幸福',
    '性别',
    '性格',
    '修理',
    '许多',
    '学期',
    '压力',
    '呀',
    '牙膏',
    '亚洲',
    '严格',
    '严重',
    '研究',
    '盐',
    '眼镜',
    '演出',
    '演员',
    '阳光',
    '养成',
    '样子',
    '邀请',
    '要是',
    '钥匙',
    '也许',
    '叶子',
    '页',
    '一切',
    '以',
    '以为',
    '艺术',
    '意见',
    '因此',
    '引起',
    '印象',
    '赢',
    '应聘',
    '永远',
    '勇敢',
    '优点',
    '优秀',
    '幽默',
    '尤其',
    '由',
    '由于',
    '邮局',
    '友好',
    '友谊',
    '有趣',
    '于是',
    '愉快',
    '与',
    '羽毛球',
    '语法',
    '语言',
    '预习',
    '原来',
    '原谅',
    '原因',
    '约会',
    '阅读',
    '云',
    '允许',
    '杂志',
    '咱们',
    '暂时',
    '脏',
    '责任',
    '增加',
    '占线',
    '招聘',
    '照',
    '真正',
    '整理',
    '正常',
    '正好',
    '正确',
    '正式',
    '证明',
    '之',
    '支持',
    '知识',
    '直接',
    '值得',
    '职业',
    '植物',
    '只好',
    '只要',
    '指',
    '至少',
    '质量',
    '重',
    '重点',
    '重视',
    '周围',
    '主意',
    '祝贺',
    '著名',
    '专门',
    '专业',
    '转',
    '赚',
    '准确',
    '准时',
    '仔细',
    '自然',
    '自信',
    '总结',
    '租',
    '最好',
    '尊重',
    '左右',
    '作家',
    '作用',
    '作者',
    '座',
    '座位',
  ];

  return words.filter((word:string) => !isKnown(word))
    .map((word:string) => {
      const row:any = {};
      row.word = word;
      row.definition = getDefaultDefinition(row.word);
      row.pinyin = getPinyin(row.word);
      return row;
    });
}

export async function topUnknownWords(bookId:number, numWords:number) {
  const top = await knex('frequency')
    .select('word')
    .where('book', bookId)
    .whereNotExists(function wordTable() {
      this.select('word')
        .from('words')
        .whereRaw('words.word==frequency.word');
    })
    .orderBy('count', 'desc')
    .limit(numWords);

  return top.map(({ word }) => word);
}

async function knownWords(book:Book) {
  const top = await knex('frequency')
    .sum({ occurance: 'count' })
    .where('book', book.bookId)
    .whereExists(function wordTable() {
      this.select('word')
        .from('words')
        .whereRaw('words.word==frequency.word');
    });
  return top[0].occurance;
}
async function allWords(book:Book) {
  const top = await knex('frequency')
    .sum({ occurance: 'count' })
    .where('book', book.bookId);
  return top[0].occurance;
}

async function loadBooks() {
  const books = await dbGetBooks();
  await Promise.all(books.map((book) => {
    book.stats = initBookStats();
    return computeBookData(book);
  }));
  return books;
}
async function learningTarget(bookIds?:number[]) {
  const words = await topWords(bookIds);
  return words;
}

async function setFavorite(bookId:number, isFavorite:boolean) {
  return knex('books').where('bookId', bookId).update({
    favorite: isFavorite,
  });
}

async function setRead(bookId:number, hasRead:boolean) {
  return knex('books').where('bookId', bookId).update({
    has_read: hasRead,
  });
}

async function totalRead() {
  const top = await knex('frequency')
    .sum({ totalWords: 'count' })
    .whereExists(function wordTable() {
      this.select('bookId')
        .from('books')
        .where('has_read', true)
        .whereRaw('books.bookId==frequency.book');
    });
  return top[0];
}

export const bookLibraryIpc = {
  loadBooks,
  learningTarget,
  loadBook,
  topUnknownWords,
  deleteBook,
  setFavorite,
  setRead,
  totalRead,
  hskWords,
};
