/**
 * Every game in the Games menu, in menu order. A new game is an entry here
 * plus its own folder under src/ (and, if it saves anything, under
 * app/Games on the server).
 */

export type Genre = 'strategy' | 'party' | 'quiz' | 'duel' | 'puzzle';

export interface GameEntry {
    slug: string;
    cover: string;
    hue: string;
    genre: Genre;
    /** Client route; null while the game is not out yet. */
    path: string | null;
}

export const CATALOG: GameEntry[] = [
    {
        slug: 'epochs',
        cover: '🏙️',
        hue: '#35b8e0',
        genre: 'strategy',
        path: '/epochs',
    },
    {
        slug: 'city',
        cover: '🏰',
        hue: '#e8a33d',
        genre: 'strategy',
        path: '/city',
    },
    { slug: 'dice', cover: '🎲', hue: '#8b5cf6', genre: 'party', path: null },
    { slug: 'quiz', cover: '🧠', hue: '#0ea5e9', genre: 'quiz', path: null },
    {
        slug: 'tictactoe',
        cover: '⭕',
        hue: '#f43f5e',
        genre: 'duel',
        path: null,
    },
    {
        slug: 'battleship',
        cover: '🚢',
        hue: '#3b82f6',
        genre: 'duel',
        path: null,
    },
    { slug: 'words', cover: '🔤', hue: '#14b8a6', genre: 'puzzle', path: null },
];
