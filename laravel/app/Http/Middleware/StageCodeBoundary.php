<?php

namespace App\Http\Middleware;

use App\Services\DandoriCatalog;
use App\Services\StageCodes;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class StageCodeBoundary
{
    public function handle(Request $request, Closure $next)
    {
        if (! Schema::hasTable('dandori_stages')) {
            return $next($request);
        }
        $route = $request->route();
        $uri = $route?->uri() ?? '';
        foreach (['stage', 'stage_id', 'stageId', 'id'] as $key) {
            $value = $route?->parameter($key);
            $isStage = $key !== 'id' || in_array($uri, ['api/stage/{id}', 'api/record/{id}/{console?}/{rule?}/{year?}/{difficulty?}/{compare?}'], true);
            if ($isStage && is_string($value) && preg_match('/\A4[a-zA-Z][a-zA-Z0-9]\z/', $value)) {
                $id = StageCodes::resolve($value);
                abort_unless($id, 404);
                $route->setParameter($key, $id);
            }
        }
        if ($request->isMethod('POST') && $uri === 'api/record') {
            $id = StageCodes::resolve((string) $request->input('stage_id'));
            abort_unless($id, 422);
            $request->merge(['stage_id' => $id]);
        }
        if ($uri === 'api/stage/{id}') {
            $id = (int) $route->parameter('id');
            $isNew = DB::table('stages')->where('stage_id', $id)->where('parent', 48)->exists();
            abort_if($isNew && ! in_array($id, DandoriCatalog::ids(), true), 404);
        }
        $response = $next($request);
        if ($response instanceof JsonResponse && $response->isSuccessful()
            && preg_match('~^api/(?:record|stage|stages|new|total|user/|dandori$)~', $uri)
            && ! str_starts_with($uri, 'api/dandori/manage')) {
            $metadata = DB::table('stages')->whereNotNull('stage_code')->get()->keyBy('stage_id');
            $settings = DB::table('dandori_stages')->get()->keyBy('stage_id');
            $published = DandoriCatalog::ids();
            $transform = function ($value) use (&$transform, $metadata, $settings, $published, $request) {
                if (! is_array($value)) {
                    return $value;
                }
                $id = $value['stage_id'] ?? $value['stage'] ?? null;
                if (is_numeric($id)) {
                    $id = (int) $id;
                    $stage = $metadata->get($id);
                    $config = $settings->get($id);
                    if ($stage) {
                        $value['stage_code'] = $stage->stage_code;
                        $value['stage_name'] = $stage->stage_name;
                        $value['eng_stage_name'] = $stage->eng_stage_name;
                        if (preg_match('/[A-Z]/', $stage->stage_code)) {
                            foreach (['stage_id', 'stage'] as $key) {
                                if (isset($value[$key])) {
                                    $value[$key] = $stage->stage_code;
                                }
                            }
                        }
                    }
                    if (in_array($id, $published, true)) {
                        $value['dandori_available'] = true;
                    }
                    $rule = (int) ($value['rule'] ?? $request->route('rule') ?? $request->query('rule') ?? 0);
                    if ($config && ($rule === 48 || ($value['parent'] ?? 0) === 48)) {
                        $value['score_type'] = $config->score_type;
                        $value['score_order'] = $config->score_order;
                        $value['dandori_consoles'] = json_decode($config->consoles, true);
                    }
                }
                foreach ($value as $key => $child) {
                    if (is_array($child)) {
                        $value[$key] = $transform($child);
                    }
                }
                return $value;
            };
            $response->setData($transform($response->getData(true)));
        }
        return $response;
    }
}
