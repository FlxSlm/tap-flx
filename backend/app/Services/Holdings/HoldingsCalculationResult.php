<?php

namespace App\Services\Holdings;

final class HoldingsCalculationResult implements \JsonSerializable
{
    public function __construct(
        public readonly string $status,
        public readonly array $reasons,
        public readonly ?array $baseline,
        public readonly array $items,
        public readonly string $inputVersion,
        public readonly array $window,
        public readonly array $excluded,
    ) {}

    public function jsonSerialize(): array
    {
        return [
            'status' => $this->status, 'reasons' => $this->reasons, 'baseline' => $this->baseline,
            'items' => $this->items, 'input_version' => $this->inputVersion,
            'rule_version' => 'holdings-v1', 'window' => $this->window,
            'quantity_basis' => 'ACCEPTED_INPUTS_ONLY',
            'excluded_events' => $this->excluded, 'recalculation' => 'ON_DEMAND_NO_PERSISTED_CACHE',
            'reconciliation_status' => 'NOT_RUN',
        ];
    }
}
