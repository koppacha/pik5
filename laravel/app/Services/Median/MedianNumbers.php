<?php

namespace App\Services\Median;

class MedianNumbers
{
    public static function compare(string $left, string $right): int
    {
        $parts = static function (string $value): array {
            if (!preg_match('/\A(-?)([0-9])(?:\.([0-9]{1,29}))?e([+-]?[0-9]{1,6})\z/', $value, $m)) {
                throw new \InvalidArgumentException('Invalid canonical number');
            }
            return [$m[2] === '0' ? 0 : ($m[1] === '-' ? -1 : 1), (int) $m[4], str_pad($m[2].($m[3] ?? ''), 30, '0')];
        };
        [$aSign, $aExp, $aDigits] = $parts($left);
        [$bSign, $bExp, $bDigits] = $parts($right);
        if ($aSign !== $bSign) return $aSign <=> $bSign;
        if ($aSign === 0) return 0;
        return $aSign * (($aExp <=> $bExp) ?: strcmp($aDigits, $bDigits));
    }

    public static function isUnanswered(array $answer): bool
    {
        // A missing raw field in legacy data is not evidence of a blank submission.
        return array_key_exists('raw', $answer)
            && preg_match('/\A[\s\p{Z}\x{FEFF}]*\z/u', (string) ($answer['raw'] ?? '')) === 1;
    }

    public static function score(array $answers): array
    {
        $answers = array_values(array_filter($answers, fn ($answer) => !self::isUnanswered($answer)));
        $values = array_values(array_unique(array_column($answers, 'value')));
        usort($values, [self::class, 'compare']);
        if (!$values) return [];
        $median = $values[intdiv(count($values), 2)];
        foreach ($answers as &$answer) {
            $answer['median'] = self::compare($answer['value'], $median) === 0;
            $answer['minimum'] = self::compare($answer['value'], $values[0]) === 0;
            $answer['maximum'] = self::compare($answer['value'], $values[count($values) - 1]) === 0;
            $answer['points'] = $answer['median'] ? 2 : (($answer['minimum'] || $answer['maximum']) ? -1 : 0);
        }
        return $answers;
    }
}
