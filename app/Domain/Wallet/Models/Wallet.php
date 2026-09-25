<?php

namespace App\Domain\Wallet\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

class Wallet extends Model
{
    protected $fillable = [
        'balance',
        'user_id',
        'currency_id'
    ]; 
}
