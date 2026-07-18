<?php

namespace App\Domain\Ban\Enums;

enum BanStatus: string
{
    case Active = 'active';
    case Revoked = 'revoked';
    case Expired = 'expired';
}