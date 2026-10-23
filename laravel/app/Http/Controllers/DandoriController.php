<?php

namespace App\Http\Controllers;

use App\Services\DandoriCatalog;
use App\Services\ManagementIdentity;
use App\Services\StageCodes;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;

class DandoriController extends Controller
{
    public function index()
    {
        $ids = DandoriCatalog::ids();
        return response()->json(['rule' => 48, 'name' => 'だれでもダンドリ検定', 'plannedCount' => 72,
            'stages' => DandoriCatalog::stages($ids), ...DandoriCatalog::monthly()]);
    }

    public function manage(Request $request, ManagementIdentity $identity)
    {
        $actor = $identity->resolve($request);
        abort_unless(Schema::hasTable('dandori_permissions'), 503, '管理用migrationが必要です');
        abort_unless($actor['role'] === 10 || DB::table('dandori_permissions')->where('user_id', $actor['user'])->exists(), 403);
        if ($request->isMethod('GET')) {
            $releases = DB::table('dandori_releases')->orderBy('month')->get()->map(function ($release) {
                $ids = DB::table('dandori_slots')->where('release_id', $release->id)->orderBy('position')->pluck('stage_id')->all();
                return [...(array) $release, 'stages' => DandoriCatalog::stages($ids)];
            });
            return response()->json(['releases' => $releases, 'admin' => $actor['role'] === 10,
                'permissions' => $actor['role'] === 10 ? DB::table('dandori_permissions')->get(['user_id', 'created_at']) : [],
                'candidates' => DB::table('stages')->where('series', 4)->where('type', 'stage')->orderBy('stage_id')
                    ->get(['stage_id', 'stage_code', 'stage_name', 'eng_stage_name', 'parent', 'difficulty']),
            ]);
        }
        if (in_array($request->input('action'), ['grant', 'revoke'], true)) {
            abort_unless($actor['role'] === 10, 403);
            $data = $request->validate(['subject' => ['required', 'string', 'max:191', 'regex:/\A[a-zA-Z0-9_-]+\z/']]);
            DB::transaction(function () use ($data, $request, $actor) {
                if ($request->input('action') === 'grant') {
                    DB::table('dandori_permissions')->updateOrInsert(['user_id' => $data['subject']], ['granted_by' => $actor['user'], 'created_at' => now(), 'updated_at' => now()]);
                } else {
                    DB::table('dandori_permissions')->where('user_id', $data['subject'])->delete();
                }
                $this->audit($actor['user'], $request->input('action'), ['subject' => $data['subject']]);
            });
            return response()->json(['ok' => true]);
        }
        $data = $request->validate([
            'month' => ['required', 'date_format:Y-m', 'after_or_equal:2026-11', 'before_or_equal:2027-10'],
            'revision' => ['required', 'integer', 'min:0'],
            'publish_at' => ['nullable', 'date', 'after_or_equal:2026-11-11T15:00:00Z'],
            'stages' => ['required', 'array', 'min:1', 'max:6'],
            'stages.*.mode' => ['required', Rule::in(['new', 'reuse'])],
            'stages.*.stage_code' => ['nullable', 'string', 'max:16'],
            'stages.*.stage_name' => ['required_if:stages.*.mode,new', 'nullable', 'string', 'max:191'],
            'stages.*.eng_stage_name' => ['nullable', 'string', 'max:191'],
            'stages.*.stage_sub' => ['nullable', 'string', 'max:191'],
            'stages.*.difficulty' => ['required', 'integer', 'between:1,3'],
            'stages.*.score_type' => ['required', Rule::in(['points', 'time'])],
            'stages.*.score_order' => ['required', Rule::in(['ASC', 'DESC'])],
            'stages.*.total_base' => ['required', 'integer', 'min:1', 'max:999999'],
            'stages.*.consoles' => ['required', 'array', 'min:1'],
            'stages.*.consoles.*' => ['integer', 'min:1', 'max:9'],
            'stages.*.require_video' => ['required', 'boolean'],
            'stages.*.require_image' => ['required', 'boolean'],
            ...collect(['time', 'treasure', 'pikmin', 'border1', 'border2', 'border3', 'border4'])->mapWithKeys(fn ($field) => ['stages.*.'.$field => ['required', 'integer', 'min:0', 'max:999999']])->all(),
        ]);
        abort_if(! empty($data['publish_at']) && count($data['stages']) !== 6, 422, '公開には6ステージが必要です');
        if (! empty($data['publish_at'])) {
            $earliest = CarbonImmutable::parse($data['month'].'-12 00:00:00', 'Asia/Tokyo');
            abort_if(CarbonImmutable::parse($data['publish_at'])->lt($earliest), 422, '配信月の12日より前には公開できません');
        }
        return DB::transaction(function () use ($data, $actor) {
            DB::table('dandori_locks')->where('id', 1)->lockForUpdate()->first();
            $release = DB::table('dandori_releases')->where('month', $data['month'])->first();
            abort_if(($release?->revision ?? 0) !== (int) $data['revision'], 409, '別の操作で更新されました。再取得してください');
            // Published batches are immutable: past records must keep their meaning.
            abort_if($release?->publish_at !== null, 409, '公開済みの配信回は変更できません');
            $ids = [];
            foreach ($data['stages'] as $input) {
                if ($input['mode'] === 'new') {
                    abort_if(trim((string) ($input['stage_name'] ?? '')) === '', 422, 'ステージ名が必要です');
                    [$id, $code] = StageCodes::allocate();
                    DB::table('stages')->insert([
                        'stage_id' => $id, 'stage_code' => $code, 'stage_name' => $input['stage_name'],
                        'eng_stage_name' => ($input['eng_stage_name'] ?? '') ?: $input['stage_name'], 'stage_sub' => $input['stage_sub'] ?? '',
                        'type' => 'stage', 'display' => $input['score_type'] === 'time' ? 'time' : 'int', 'series' => 4, 'parent' => 48,
                        'difficulty' => $input['difficulty'],
                        ...array_intersect_key($input, array_flip(['time', 'treasure', 'pikmin', 'border1', 'border2', 'border3', 'border4'])),
                        'created_at' => now(), 'updated_at' => now(),
                    ]);
                } else {
                    $id = StageCodes::resolve($input['stage_code'] ?? '');
                    abort_unless($id && DB::table('stages')->where('stage_id', $id)->where('series', 4)->where('type', 'stage')->exists(), 422, '対象ステージがありません');
                }
                abort_if(in_array($id, $ids, true), 422, '同じ配信回に同一ステージを重複登録できません');
                $ids[] = $id;
                $settings = ['score_type' => $input['score_type'], 'score_order' => $input['score_order'],
                    'total_base' => $input['total_base'], 'consoles' => json_encode(array_values(array_unique($input['consoles']))),
                    'require_video' => (int) $input['require_video'], 'require_image' => (int) $input['require_image']];
                $existing = DandoriCatalog::settings($id);
                $published = DB::table('dandori_slots as slot')->join('dandori_releases as release', 'release.id', '=', 'slot.release_id')->where('slot.stage_id', $id)->whereNotNull('release.publish_at')->exists();
                $difficulty = DB::table('stages')->where('stage_id', $id)->value('difficulty');
                abort_if($published && $difficulty !== null && (int) $difficulty !== (int) $input['difficulty'], 409, '公開済みステージの難易度は変更できません');
                if (! $published || $difficulty === null) {
                    DB::table('stages')->where('stage_id', $id)->update(['difficulty' => $input['difficulty']]);
                }
                if ($existing && $published) {
                    foreach ($settings as $key => $value) {
                        abort_if((string) $existing->$key !== (string) $value, 409, '公開済みステージの採点・投稿条件は変更できません');
                    }
                }
                DB::table('dandori_stages')->updateOrInsert(['stage_id' => $id], [...$settings, 'created_at' => $existing?->created_at ?? now(), 'updated_at' => now()]);
            }
            $values = ['revision' => ($release?->revision ?? 0) + 1,
                'publish_at' => empty($data['publish_at']) ? null : CarbonImmutable::parse($data['publish_at'])->utc()->format('Y-m-d H:i:s'), 'updated_at' => now()];
            $releaseId = $release?->id;
            if ($releaseId) {
                DB::table('dandori_releases')->where('id', $releaseId)->update($values);
                DB::table('dandori_slots')->where('release_id', $releaseId)->delete();
            } else {
                $releaseId = DB::table('dandori_releases')->insertGetId([...$values, 'month' => $data['month'], 'created_at' => now()]);
            }
            foreach ($ids as $position => $id) {
                DB::table('dandori_slots')->insert(['release_id' => $releaseId, 'position' => $position + 1, 'stage_id' => $id]);
            }
            $this->audit($actor['user'], 'save-release', ['month' => $data['month'], 'stage_ids' => $ids, 'revision' => $values['revision'], 'publish_at' => $values['publish_at']]);
            return response()->json(['ok' => true, 'revision' => $values['revision']]);
        });
    }

    private function audit(string $user, string $operation, array $details): void
    {
        DB::table('dandori_audits')->insert(['user_id' => $user, 'operation' => $operation, 'details' => json_encode($details), 'created_at' => now()]);
    }
}
