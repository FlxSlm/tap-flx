<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TransactionResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'investment_account_id' => $this->investment_account_id,
            'transaction_date' => $this->transaction_date,
            'type' => $this->type,
            'symbol' => $this->symbol,
            'asset_name' => $this->asset_name,
            'quantity' => $this->quantity,
            'price' => $this->price,
            'total_amount' => $this->total_amount,
            'currency' => $this->currency,
            'fee_amount' => $this->fee_amount,
            'external_identifier' => $this->external_identifier,
            'transaction_hash' => $this->transaction_hash,
            'source_metadata' => $this->source_metadata,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
            'gross_amount' => $this->gross_amount,
            'net_amount' => $this->net_amount,
            'tax_amount' => $this->tax_amount,
            'settlement_amount' => $this->settlement_amount,
            'amount_semantics' => $this->amount_semantics,
            'unit' => $this->unit,
            'date_precision' => $this->date_precision,
            'reference_quantity' => $this->reference_quantity,
            'imported_at' => $this->imported_at,
            'validation_status' => $this->validation_status,
            'review_status' => $this->review_status,
            'revision' => $this->revision,
        ];
    }
}
