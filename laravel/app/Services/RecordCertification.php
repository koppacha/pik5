<?php

namespace App\Services;

class RecordCertification
{
    public const MARKER = '[pik5:dandori-certified:v1]';

    public static function isCertified(int $rule, ?string $memo): bool
    {
        return $rule === 48 && in_array(self::MARKER, preg_split('/\s+/', trim($memo ?? '')), true);
    }

    public static function memo(string $memo, int $rule, bool $certified): string
    {
        $parts = array_filter(preg_split('/\s+/', trim($memo)), fn ($part) => $part !== '' && $part !== self::MARKER);
        if ($rule === 48 && $certified) $parts[] = self::MARKER;
        return implode(' ', $parts);
    }
}
