<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Product extends Model
{
    use HasFactory;

    public mixed $name = "string";
    public mixed $detail = "string";
    /**
     * 複数代入可能な属性
     *
     * @var array
     */
    protected $fillable = [
      'name', 'detail'
    ];
}
