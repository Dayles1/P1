<?php

namespace App\Domain\Audit\Traits;

use App\Domain\Audit\Models\Audit;
use App\Domain\Audit\Services\AuditLogger;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Support\Arr;

trait RecordsAudits
{
    public static function bootRecordsAudits(): void
    {
        static::created(function (self $model): void {
            $model->writeAudit('created', [], $model->auditNewValues());
        });

        static::updated(function (self $model): void {
            $old = [];
            $new = [];

            foreach ($model->getDirty() as $key => $value) {
                if ($model->isAuditIgnored($key)) {
                    continue;
                }

                $old[$key] = $model->getOriginal($key);
                $new[$key] = $value;
            }

            if (! empty($new)) {
                $model->writeAudit('updated', $old, $new);
            }
        });

        static::deleted(function (self $model): void {
            $model->writeAudit('deleted', $model->auditOldValues(), []);
        });

        static::restored(function (self $model): void {
            $model->writeAudit('restored', [], []);
        });
    }

    /**
     * @return MorphMany<Audit, $this>
     */
    public function audits(): MorphMany
    {
        return $this->morphMany(Audit::class, 'subject')->latest();
    }

    /**
     * @param  array<string, mixed>  $oldValues
     * @param  array<string, mixed>  $newValues
     * @param  array<string, mixed>  $meta
     */
    public function writeAudit(
        string $event,
        array $oldValues = [],
        array $newValues = [],
        ?string $title = null,
        ?string $description = null,
        array $meta = []
    ): Audit {
        return app(AuditLogger::class)->record(
            subject: $this,
            event: $event,
            oldValues: $oldValues,
            newValues: $newValues,
            title: $title,
            description: $description,
            meta: $meta,
        );
    }

    /**
     * @return array<string, mixed>
     */
    protected function auditOldValues(): array
    {
        return $this->filterAuditValues($this->getOriginal());
    }

    /**
     * @return array<string, mixed>
     */
    protected function auditNewValues(): array
    {
        return $this->filterAuditValues($this->getAttributes());
    }

    /**
     * @param  array<string, mixed>  $values
     * @return array<string, mixed>
     */
    protected function filterAuditValues(array $values): array
    {
        $ignore = $this->getAuditIgnored();

        return Arr::except($values, $ignore);
    }

    /**
     * @return array<int, string>
     */
    protected function getAuditIgnored(): array
    {
        return property_exists($this, 'auditIgnored')
            ? (array) $this->auditIgnored
            : [
                'password',
                'remember_token',
                'updated_at',
                'created_at',
                'deleted_at',
            ];
    }

    protected function isAuditIgnored(string $key): bool
    {
        return in_array($key, $this->getAuditIgnored(), true);
    }
}
