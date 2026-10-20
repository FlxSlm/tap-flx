<?php

namespace App\Services\Integrity;

use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

final class TransactionContract
{
    public static function rules(): array
    {
        $rules = [
            'investment_account_id' => ['required', 'integer', 'exists:investment_accounts,id'],
            'transaction_date' => ['required', 'date'],
            'date_precision' => ['sometimes', Rule::in(['DATE', 'TIMESTAMP'])],
            'type' => ['required', Rule::in(['BUY', 'SELL', 'DIVIDEND', 'FEE', 'DEPOSIT', 'WITHDRAWAL'])],
            'symbol' => ['nullable', 'string', 'max:30', 'regex:/^[A-Za-z0-9._-]+$/D'],
            'asset_name' => ['nullable', 'string', 'max:150'],
            'currency' => ['required', 'regex:/^[A-Z]{3,8}$/D'],
            'unit' => ['sometimes', Rule::in(['SHARE', 'LOT', 'COIN', 'UNKNOWN'])],
            'amount_semantics' => ['sometimes', Rule::in(['UNKNOWN', 'GROSS', 'NET', 'SETTLEMENT'])],
            'external_identifier' => ['nullable', 'string', 'max:80', 'regex:/^[A-Za-z0-9._:-]+$/D'],
            // Legacy clients may send this object, but arbitrary metadata is never persisted.
            'source_metadata' => ['nullable', 'array'],
        ];
        foreach (['quantity', 'reference_quantity', 'price'] as $key) {
            $rules[$key] = ['nullable', 'regex:/^\d{1,16}(?:\.\d{1,8})?$/D'];
        }
        foreach (['total_amount', 'fee_amount', 'gross_amount', 'net_amount', 'tax_amount', 'settlement_amount'] as $key) {
            $rules[$key] = [$key === 'total_amount' ? 'required' : 'nullable', 'regex:/^\d{1,20}(?:\.\d{1,4})?$/D'];
        }

        return $rules;
    }

    public static function validate(array $data): array
    {
        $validator = Validator::make($data, self::rules());
        $validator->after(function ($validator) use ($data) {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }
            if (in_array($data['type'], ['BUY', 'SELL'])) {
                foreach (['symbol', 'quantity', 'price'] as $field) {
                    if (! isset($data[$field]) || $data[$field] === '' || ($field === 'quantity' && Decimal::normalize($data[$field]) === '0')) {
                        $validator->errors()->add($field, 'Required for BUY/SELL; quantity must be positive.');
                    }
                }
            }
            $basis = $data['amount_semantics'] ?? 'UNKNOWN';
            if (($data['date_precision'] ?? 'TIMESTAMP') === 'DATE'
                && ! preg_match('/^\d{4}-\d{2}-\d{2}(?:[ T]00:00(?::00)?)?$/D', $data['transaction_date'])) {
                $validator->errors()->add('transaction_date', 'DATE precision requires a calendar date, optionally with midnight and no timezone.');
            }
            $field = ['GROSS' => 'gross_amount', 'NET' => 'net_amount', 'SETTLEMENT' => 'settlement_amount'][$basis] ?? null;
            if ($field && (! isset($data[$field]) || Decimal::normalize($data[$field]) !== Decimal::normalize($data['total_amount']))) {
                $validator->errors()->add('total_amount', 'Total must equal the explicitly selected amount basis.');
            }
            if ($data['type'] === 'DIVIDEND' && isset($data['quantity'])) {
                $validator->errors()->add('quantity', 'Cash dividend balance belongs in reference_quantity, not event quantity.');
            }
            if (in_array($data['type'], ['BUY', 'SELL']) && isset($data['gross_amount'], $data['quantity'], $data['price'])
                && Decimal::normalize($data['gross_amount']) !== Decimal::multiply((string) $data['quantity'], (string) $data['price'])) {
                $validator->errors()->add('gross_amount', 'Gross does not equal quantity times price; review source precision before import.');
            }
            if (isset($data['gross_amount'], $data['net_amount'], $data['fee_amount'], $data['tax_amount'])) {
                if ($data['type'] === 'BUY') {
                    $consistent = Decimal::normalize($data['net_amount']) === Decimal::add((string) $data['gross_amount'], (string) $data['fee_amount'], (string) $data['tax_amount']);
                } elseif (in_array($data['type'], ['SELL', 'DIVIDEND'])) {
                    $consistent = Decimal::normalize($data['gross_amount']) === Decimal::add((string) $data['net_amount'], (string) $data['fee_amount'], (string) $data['tax_amount']);
                } else {
                    $consistent = true;
                }
                if (! $consistent) {
                    $validator->errors()->add('net_amount', 'Known gross, net, fee and tax are inconsistent.');
                }
            }
        });
        $validated = $validator->validate();
        unset($validated['source_metadata']);

        return TransactionIdentity::canonicalize($validated);
    }
}
