<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Score extends Model
{
    protected $fillable = ['card_id', 'player_id', 'score', 'rank'];
}
