<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Record extends Model
{
    use HasFactory;

    /**
     * Primary key settings.
     */
    protected $primaryKey = 'post_id';
    public $incrementing = true;
    protected $keyType = 'int';

    /**
     * 複数代入可能な属性
     *
     * @var array
     */
    protected $guarded = [
      'created_at',
    ];
    public function user(): HasOne
    {
        return $this->hasOne(User::class,'user_id','user_id');
    }
}
