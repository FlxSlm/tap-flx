<?php

namespace App\Services\Automatic;

use RuntimeException;

final class AutomaticFailure extends RuntimeException
{
    public function __construct(public readonly string $reason)
    {
        parent::__construct('Automatic processing requires attention.');
    }
}
