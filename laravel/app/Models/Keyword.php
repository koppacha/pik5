<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Keyword extends Model
{
    use HasFactory;

    protected $fillable = ['unique_id','keyword','flag', 'category', 'tag', 'yomi', 'content','first_editor','last_editor'];
}
