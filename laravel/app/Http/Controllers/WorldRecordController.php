<?php

namespace App\Http\Controllers;

use App\Library\Func;
use App\Services\StageCodes;
use App\Services\WorldRecordPolicy;
use App\Services\Tricks\TrickRequestIdentity;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class WorldRecordController extends Controller
{
    private function target(string $code, int $rule): int
    {
        abort_unless(in_array($rule, [31, 32, 33, 34, 36, 48], true), 422, '世界記録報告の対象外です');
        $id = StageCodes::resolve($code);
        abort_unless($id && DB::table('stages')->where('stage_id', $id)->exists()
            && in_array($id, TotalController::stage_list((string) $rule), true), 422, '対象ステージがありません');
        return $id;
    }

    public function show(string $stage, int $rule)
    {
        $id = $this->target($stage, $rule);
        $reports = DB::table('world_record_reports')->where('stage_id', $id)->where('rule', $rule)->where('is_active', true)->whereNull('deleted_at')
            ->whereIn('platform', WorldRecordPolicy::platforms($id, $rule))
            ->orderBy('score', Func::orderByRule($id, $rule)[1])->orderBy('id')
            ->get(['id', 'holder_name', 'score', 'platform', 'img_url', 'created_at'])->unique('platform')->values();
        foreach ($reports as $report) {
            $report->score_order = Func::orderByRule($id, $rule)[1];
            $report->score_type = $rule === 48 ? \App\Services\DandoriCatalog::settings($id)->score_type : (in_array($id, [338, 341, 343, 345, 346, 347, 348, 349, 350], true) ? 'time' : 'points');
        }
        return response()->json(['records' => $reports, 'record' => $reports->first()]);
    }

    public function capabilities(Request $request, TrickRequestIdentity $identity)
    {
        $actor = $identity->resolve($request);
        abort_unless($actor && ! $identity->isTest($request), 401);
        return response()->json(['can_report' => WorldRecordPolicy::canReport($actor), 'can_delete' => $identity->role($request) === 10]);
    }

    public function destroy(Request $request, int $id, TrickRequestIdentity $identity)
    {
        $actor = $identity->resolve($request);
        abort_unless($actor && ! $identity->isTest($request), 401);
        abort_unless($identity->role($request) === 10, 403);
        $reporter = DB::table('world_record_reports')->where('id', $id)->value('reporter_user_id');
        abort_unless($reporter, 404);
        DB::transaction(function () use ($id, $actor, $reporter) {
            WorldRecordPolicy::lockReporter($reporter);
            $report = DB::table('world_record_reports')->where('id', $id)->lockForUpdate()->first();
            abort_unless($report, 404);
            if ($report->deleted_at !== null) return;
            DB::table('world_record_reports')->where('id', $id)->update([
                'is_active' => false, 'deleted_at' => now(), 'deleted_by' => $actor, 'updated_at' => now(),
            ]);
        }, 3);
        return response()->json(['ok' => true]);
    }

    public function store(Request $request, TrickRequestIdentity $identity)
    {
        $actor = $identity->resolve($request);
        abort_unless($actor && ! $identity->isTest($request), 401);
        $data = $request->validate([
            'stage_id' => ['required', 'string', 'max:16'],
            'rule' => ['required', 'integer'],
            'holder_name' => ['required', 'string', 'max:100'],
            'score' => ['required', 'integer', 'between:1,999999'],
            'platform' => ['required', 'integer'],
            'file' => ['nullable', 'image', 'mimes:jpg,jpeg,png,gif,webp', 'max:5120'],
        ]);
        $data['holder_name'] = trim($data['holder_name']);
        abort_if($data['holder_name'] === '', 422, '世界記録保持者名が必要です');
        $id = $this->target($data['stage_id'], (int) $data['rule']);
        abort_unless(in_array((int) $data['platform'], WorldRecordPolicy::platforms($id, (int) $data['rule']), true), 422, '対応していないプラットフォームです');
        $filename = '';
        try {
            if ($request->hasFile('file')) {
                $image = $request->file('file');
                $filename = 'world-'.bin2hex(random_bytes(16)).'.'.$image->extension();
                abort_unless($image->storeAs('img', $filename, 'public'), 422, '画像を保存できません');
            }
            $reportId = DB::transaction(function () use ($actor, $id, $data, $filename) {
                WorldRecordPolicy::lockReporter($actor);
                abort_unless(WorldRecordPolicy::canReport($actor), 403, '投稿できません');
                return DB::table('world_record_reports')->insertGetId([
                'stage_id' => $id, 'rule' => $data['rule'], 'reporter_user_id' => $actor,
                'platform' => $data['platform'],
                'holder_name' => $data['holder_name'], 'score' => $data['score'], 'img_url' => $filename,
                'is_active' => true, 'created_at' => now(), 'updated_at' => now(),
                ]);
            }, 3);
        } catch (\Throwable $error) {
            if ($filename !== '') Storage::disk('public')->delete('img/'.$filename);
            throw $error;
        }
        return response()->json(['ok' => true, 'id' => $reportId], 201);
    }
}
