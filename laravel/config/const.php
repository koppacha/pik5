<?php

use Illuminate\Support\Facades\Facade;

return [
    // 記録呼び出し時に隠し要素以外を選択する
    'selected' => ['post_id', 'user_id', 'score', 'stage_id', 'rule', 'console', 'region', 'unique_id', 'post_comment', 'img_url', 'video_url', 'flg', 'team', 'created_at']
];
