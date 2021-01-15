export interface SmallMovie {
    id: string;
    title: string;
    year: string;
}

export interface Movie extends SmallMovie {
    runtime: string;
    genre: string;
    plot: string;
    rating: string;
    awards: string;
}

export interface SelectableMovie extends Movie {
    suggester: number;
    removed: boolean;
    votes: Map<number, number>;
}

export interface DetailedMovie extends Movie {
    actors: string;
    director: string;
    writer: string;
    poster: string;
}

export interface NightInfo {
    name: string | null;
    votingSystem: string | null;
    winner: string | null;
    startDate: Date;
    maxSuggestions: number;
    movies: SelectableMovie[];
}

export interface HostNightInfo {
    name: string;
    votingSystem: string;
    numSuggestions: string;
    password: string;
}

export interface PhaseData {
    name?: string;
    movies?: SelectableMovie[];
    votingSystems?: string[];
    isPasswordRequired?: boolean;
    suggestedMovies?: SelectableMovie[];
    maxSuggestions?: number;
    votingSystem?: string;
    numUsers?: number;
    liveVoting?: boolean;
    winner?: string | null;
    users?: User[];
}

export interface PhaseInfo {
    name: string;
    isHost: boolean;
    isExactPhase?: boolean;
    data: PhaseData;
}

export interface MovieResults {
    success: boolean;
    errorMessage: string;
    results: SmallMovie[];
}

export interface MovieSuggestions {
    isHost: boolean;
    movies: SelectableMovie[];
}

export interface User {
    token: number;
    username: string;
}

export type OmdbQuery = 's' | 't' | 'i';

/* eslint-disable @typescript-eslint/naming-convention */
export interface OmdbResult {
    Response: string;
    Error: string;
}

export interface OmdbMovieSmall {
    imdbID: string;
    Title: string;
    Year: string;
}

export interface OmdbMovie extends OmdbMovieSmall {
    Runtime: string;
    Genre: string;
    Plot: string;
    imdbRating: string;
    Awards: string;
}

export interface OmdbMovieDetailed extends OmdbMovie {
    Actors: string;
    Director: string;
    Writer: string;
    Poster: string;
}

export interface OmdbSearchResult {
    Search: OmdbMovieSmall[];
}

export interface OmdbResponse<T extends OmdbQuery> {
    data: (T extends 's' ? OmdbSearchResult : (T extends 't' ? OmdbMovie : OmdbMovieDetailed)) & OmdbResult;
}
/* eslint-enable @typescript-eslint/naming-convention */

export interface NightHistory {
    rounds: NightInfo[];
    host: number | null;
    users: User[];
}