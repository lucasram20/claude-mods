/**
 * What the quote of the moment is about. API Ninjas only tags `philosophy` of the four
 * topics we want, and its `categories` filter is AND-only, so science, software and games
 * are matched by author instead (partial name match). Add or swap names freely; a topic
 * whose author returns nothing is skipped and the next one is tried.
 */
export interface Topic {
  name: string
  categories?: string
  authors?: string[]
}

export const TOPICS: Topic[] = [
  { name: 'philosophy', categories: 'philosophy' },
  {
    name: 'science',
    authors: ['Albert Einstein', 'Richard Feynman', 'Carl Sagan', 'Marie Curie', 'Stephen Hawking'],
  },
  {
    name: 'software',
    authors: ['Donald Knuth', 'Edsger Dijkstra', 'Linus Torvalds', 'Grace Hopper', 'Alan Kay', 'Kent Beck'],
  },
  {
    name: 'games',
    authors: ['Shigeru Miyamoto', 'Hideo Kojima', 'Sid Meier', 'Satoru Iwata', 'Gabe Newell'],
  },
]
