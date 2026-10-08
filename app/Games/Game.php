<?php

namespace App\Games;

/**
 * The games that can be played — and so timed, rated and ranked. The one
 * list of them on the server: a `{game}` route parameter outside it is a
 * 404. Values are the SPA catalog's slugs. The Sandbox lives on a page of
 * its own but is timed and rated here all the same; it keeps no score, so
 * it has no leaderboard.
 */
enum Game: string
{
    case City = 'city';
    case Epochs = 'epochs';
    case Sandbox = 'sandbox';

    /**
     * Play time a player needs in a game before they may rate it.
     */
    public const int SECONDS_TO_RATE = 300;

    /**
     * The most a single heartbeat adds: the SPA pings once a minute.
     */
    public const int HEARTBEAT_SECONDS = 60;

    /**
     * A longer silence between two heartbeats means the game was not being
     * played in between, so it adds nothing.
     */
    public const int HEARTBEAT_GAP_SECONDS = 120;
}
