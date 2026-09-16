import type { AnalyticsView, ScreenResource } from '../game/types';
import {
  EmptyState,
  formatNumber,
  ResourceNotice,
  SectionTitle,
} from '../game/ui';
import { formatRatioPercent } from './analytics-format';
import './shop-analytics.css';

type AnalyticsScreenProps = {
  resource: ScreenResource<AnalyticsView>;
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'short',
  }).format(date);
}

function RetentionChart({ cohorts }: { cohorts: AnalyticsView['cohorts'] }) {
  const visibleCohorts = cohorts.slice(-6);
  const chartWidth = 720;
  const chartHeight = 280;
  const plotTop = 34;
  const plotBottom = 220;
  const plotHeight = plotBottom - plotTop;
  const groupWidth = chartWidth / visibleCohorts.length;
  const barWidth = Math.min(32, groupWidth * 0.26);
  const maxRatio = 1;
  const y = (value: number) =>
    plotBottom -
    (Math.min(maxRatio, Math.max(0, value)) / maxRatio) * plotHeight;

  return (
    <div className="sa-chart-wrap">
      <svg
        className="sa-chart"
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        role="img"
        aria-labelledby="retention-chart-title retention-chart-description"
      >
        <title id="retention-chart-title">
          D1 ve D7 cohort tutunma grafiği
        </title>
        <desc id="retention-chart-description">
          Son {visibleCohorts.length} cohort için birinci ve yedinci gün tutunma
          yüzdelerini karşılaştıran sütun grafik.
        </desc>
        {[0, 0.5, 1].map((ratio) => {
          const gridY = plotBottom - ratio * plotHeight;
          return (
            <g key={ratio}>
              <line x1="34" x2={chartWidth - 12} y1={gridY} y2={gridY} />
              <text x="26" y={gridY + 4} textAnchor="end">
                {formatRatioPercent(maxRatio * ratio)}
              </text>
            </g>
          );
        })}
        {visibleCohorts.map((cohort, index) => {
          const center = groupWidth * index + groupWidth / 2;
          const d1Y = y(cohort.d1);
          const d7Y = y(cohort.d7);
          return (
            <g key={`${cohort.date}-${index}`}>
              <rect
                className="sa-bar-d1"
                x={center - barWidth - 3}
                y={d1Y}
                width={barWidth}
                height={plotBottom - d1Y}
                rx="4"
              >
                <title>{`${formatDate(cohort.date)} D1: ${formatRatioPercent(cohort.d1)}`}</title>
              </rect>
              <rect
                className="sa-bar-d7"
                x={center + 3}
                y={d7Y}
                width={barWidth}
                height={plotBottom - d7Y}
                rx="4"
              >
                <title>{`${formatDate(cohort.date)} D7: ${formatRatioPercent(cohort.d7)}`}</title>
              </rect>
              <text
                className="sa-chart-date"
                x={center}
                y="248"
                textAnchor="middle"
              >
                {formatDate(cohort.date)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function AnalyticsScreen({ resource }: AnalyticsScreenProps) {
  if (resource.status !== 'ready' || !resource.data) {
    const unavailableResource: ScreenResource<unknown> = resource.data
      ? resource
      : {
          ...resource,
          status: resource.status === 'ready' ? 'unavailable' : resource.status,
        };
    return (
      <section
        className="sa-screen sa-analytics"
        aria-labelledby="analytics-title"
      >
        <SectionTitle eyebrow="YÖNETİM ÖN İZLEMESİ" title="Analitik" />
        <ResourceNotice
          resource={unavailableResource}
          label="Analitik verileri"
        />
      </section>
    );
  }

  const { activation, payerConversion, revenue, arppu, cohorts } =
    resource.data;
  const metrics = [
    {
      label: 'Aktivasyon',
      value: formatRatioPercent(activation),
      note: 'Oyuna başlayanlar',
    },
    {
      label: 'Ödeyen dönüşümü',
      value: formatRatioPercent(payerConversion),
      note: 'Oyuncudan ödeyene',
    },
    {
      label: 'Gelir',
      value: `★ ${formatNumber(revenue)}`,
      note: 'Toplam Telegram Yıldızı',
    },
    {
      label: 'ARPPU',
      value: `★ ${formatNumber(arppu)}`,
      note: 'Ödeyen oyuncu başına',
    },
  ];

  return (
    <section
      className="sa-screen sa-analytics"
      aria-labelledby="analytics-title"
    >
      <SectionTitle
        eyebrow="YÖNETİM ÖN İZLEMESİ"
        title="Analitik"
        description="Oyuncu aktivasyonu, ödeme davranışı ve cohort tutunmasına sade bir bakış."
        action={<span className="badge">Yalnızca yönetici</span>}
      />

      <div
        className="sa-metric-grid"
        aria-label="Temel performans göstergeleri"
      >
        {metrics.map((metric) => (
          <article className="metric sa-metric" key={metric.label}>
            <p>{metric.label}</p>
            <strong>{metric.value}</strong>
            <span>{metric.note}</span>
          </article>
        ))}
      </div>

      <section className="panel sa-retention" aria-labelledby="retention-title">
        <div className="sa-retention-heading">
          <div>
            <p className="eyebrow">COHORT TUTUNMASI</p>
            <h2 id="retention-title">İlk haftaya dönüş</h2>
            <p className="muted">
              Kayıt tarihine göre D1 ve D7 tutunma oranları.
            </p>
          </div>
          <div className="sa-legend" aria-label="Grafik açıklaması">
            <span>
              <i className="sa-legend-d1" />
              D1
            </span>
            <span>
              <i className="sa-legend-d7" />
              D7
            </span>
          </div>
        </div>

        {cohorts.length > 0 ? (
          <>
            <RetentionChart cohorts={cohorts} />
            <div className="sa-table-wrap">
              <table className="sa-cohort-table">
                <caption>Cohort kayıt ve tutunma değerleri</caption>
                <thead>
                  <tr>
                    <th scope="col">Tarih</th>
                    <th scope="col">Kayıt</th>
                    <th scope="col">D1</th>
                    <th scope="col">D7</th>
                  </tr>
                </thead>
                <tbody>
                  {cohorts.map((cohort, index) => (
                    <tr key={`${cohort.date}-${index}`}>
                      <th scope="row">{formatDate(cohort.date)}</th>
                      <td>{formatNumber(cohort.signups)}</td>
                      <td>{formatRatioPercent(cohort.d1)}</td>
                      <td>{formatRatioPercent(cohort.d7)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <EmptyState
            title="Cohort verisi henüz oluşmadı"
            description="Oyuncu kayıtları ölçüm dönemini tamamladığında D1 ve D7 tutunması burada görünecek."
          />
        )}
      </section>
    </section>
  );
}
