<?php

namespace App\Services\Integrity;

use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

final class SnapshotContract
{
    public static function validate(array $data): array
    {
        $v = Validator::make($data, [
            'investment_account_id' => 'required|integer|exists:investment_accounts,id',
            'as_of_date' => 'required|date_format:Y-m-d',
            'provider' => ['required', Rule::in(['BIONS', 'STOCKBIT', 'PLUANG'])],
            'document_type' => ['nullable', Rule::in(['SOA'])],
            'coverage' => ['sometimes', Rule::in(['FULL', 'PARTIAL', 'UNKNOWN'])],
            'coverage_confirmed' => 'sometimes|boolean',
            'parsed_item_count' => 'nullable|integer|min:0|max:1000',
            'period_start' => 'nullable|date_format:Y-m-d',
            'period_end' => 'nullable|date_format:Y-m-d|after_or_equal:period_start',
            'items' => 'present|array|list|max:1000',
            'items.*' => 'array:symbol,asset_name,quantity,average_price,market_price,market_value,currency,unit,as_of_date',
            'items.*.symbol' => ['required', 'regex:/^[A-Z0-9._-]{1,30}$/D', 'distinct:strict'],
            'items.*.asset_name' => 'nullable|string|max:150',
            'items.*.quantity' => ['required', 'regex:/^\d{1,16}(?:\.\d{1,8})?$/D'],
            'items.*.average_price' => ['nullable', 'regex:/^\d{1,16}(?:\.\d{1,8})?$/D'],
            'items.*.market_price' => ['nullable', 'regex:/^\d{1,16}(?:\.\d{1,8})?$/D'],
            'items.*.market_value' => ['nullable', 'regex:/^\d{1,20}(?:\.\d{1,4})?$/D'],
            'items.*.currency' => ['sometimes', 'regex:/^[A-Z]{3,8}$/D'],
            'items.*.unit' => ['sometimes', Rule::in(['SHARE', 'LOT', 'COIN', 'UNKNOWN'])],
        ]);
        $v->after(function ($v) use ($data) {
            if ($v->errors()->isNotEmpty()) {
                return;
            }
            if (($data['coverage'] ?? 'UNKNOWN') === 'FULL'
                && (empty($data['coverage_confirmed']) || ! isset($data['parsed_item_count']) || (int) $data['parsed_item_count'] !== count($data['items'] ?? []))) {
                $v->errors()->add('coverage', 'FULL requires explicit confirmation and the complete parsed item count.');
            }
        });
        $validated = $v->validate();
        $validated['coverage'] ??= 'UNKNOWN';
        $validated['coverage_confirmed'] ??= false;
        $validated['activity_coverage'] = 'UNKNOWN';
        $validated['review_status'] = 'REQUIRED';
        foreach ($validated['items'] as &$item) {
            $item = array_intersect_key($item, array_flip(['symbol', 'asset_name', 'quantity', 'average_price', 'market_price', 'market_value', 'currency', 'unit']));
            $item['unit'] ??= 'UNKNOWN';
        }

        return $validated;
    }
}
