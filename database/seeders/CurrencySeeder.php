<?php

namespace Database\Seeders;

use App\Domain\Currency\Models\Currency;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * The currency catalogue: every code the rate provider quotes (166 of
 * them), with its English name, its symbol where one is in common use,
 * and its ISO 4217 minor units.
 *
 * Deliberately offline. A currency existing is not the same question as
 * today's rate for it having been fetched, so seeding a fresh install —
 * or a CI run — must not depend on the provider being reachable.
 *
 * `is_active` is set on insert and left alone afterwards: re-seeding
 * refreshes names and symbols without switching a currency an
 * administrator turned off back on.
 */
class CurrencySeeder extends Seeder
{
    public function run(): void
    {
        $rows = array_map(
            static fn (array $currency): array => [
                'code' => $currency[0],
                'name' => $currency[1],
                'symbol' => $currency[2],
                'decimals' => $currency[3],
                'is_active' => true,
            ],
            $this->currencies()
        );

        DB::transaction(function () use ($rows): void {
            foreach (array_chunk($rows, 100) as $chunk) {
                Currency::query()->upsert($chunk, ['code'], ['name', 'symbol', 'decimals']);
            }
        });
    }

    /**
     * [code, name, symbol, ISO 4217 minor units]
     *
     * @return list<array{0: string, 1: string, 2: string|null, 3: int}>
     */
    private function currencies(): array
    {
        return [
            ['AED', 'United Arab Emirates Dirham', null, 2],
            ['AFN', 'Afghan Afghani', '؋', 2],
            ['ALL', 'Albanian Lek', 'Lekë', 2],
            ['AMD', 'Armenian Dram', '֏', 2],
            ['ANG', 'Netherlands Antillean Guilder', 'NAf.', 2],
            ['AOA', 'Angolan Kwanza', 'Kz', 2],
            ['ARS', 'Argentine Peso', '$AR', 2],
            ['AUD', 'Australian Dollar', 'A$', 2],
            ['AWG', 'Aruban Florin', 'Afl', 2],
            ['AZN', 'Azerbaijani Manat', '₼', 2],
            ['BAM', 'Bosnia-Herzegovina Convertible Mark', 'KM', 2],
            ['BBD', 'Barbadian Dollar', 'Bds$', 2],
            ['BDT', 'Bangladeshi Taka', '৳', 2],
            ['BGN', 'Bulgarian Lev', 'лв.', 2],
            ['BHD', 'Bahraini Dinar', null, 3],
            ['BIF', 'Burundian Franc', 'FBu', 0],
            ['BMD', 'Bermudan Dollar', '$BM', 2],
            ['BND', 'Brunei Dollar', '$BN', 2],
            ['BOB', 'Bolivian Boliviano', 'Bs', 2],
            ['BRL', 'Brazilian Real', 'R$', 2],
            ['BSD', 'Bahamian Dollar', 'BS$', 2],
            ['BTN', 'Bhutanese Ngultrum', 'Nu.', 2],
            ['BWP', 'Botswanan Pula', 'ߓߥߔ', 2],
            ['BYN', 'Belarusian Ruble', 'Br', 2],
            ['BZD', 'Belize Dollar', '$BZ', 2],
            ['CAD', 'Canadian Dollar', 'CA$', 2],
            ['CDF', 'Congolese Franc', 'FC', 2],
            ['CHF', 'Swiss Franc', null, 2],
            ['CLF', 'Chilean Unit of Account (UF)', null, 4],
            ['CLP', 'Chilean Peso', '$CL', 0],
            ['CNH', 'Chinese Yuan (offshore)', null, 2],
            ['CNY', 'Chinese Yuan', 'CN¥', 2],
            ['COP', 'Colombian Peso', '$CO', 2],
            ['CRC', 'Costa Rican Colón', '₡', 2],
            ['CUP', 'Cuban Peso', '$', 2],
            ['CVE', 'Cape Verdean Escudo', '​', 2],
            ['CZK', 'Czech Koruna', 'Кч', 2],
            ['DJF', 'Djiboutian Franc', 'Fdj', 0],
            ['DKK', 'Danish Krone', 'kr.', 2],
            ['DOP', 'Dominican Peso', 'RD$', 2],
            ['DZD', 'Algerian Dinar', 'DA', 2],
            ['EGP', 'Egyptian Pound', 'EG£', 2],
            ['ERN', 'Eritrean Nakfa', 'Nfk', 2],
            ['ETB', 'Ethiopian Birr', 'Br', 2],
            ['EUR', 'Euro', '€', 2],
            ['FJD', 'Fijian Dollar', '$FJ', 2],
            ['FKP', 'Falkland Islands Pound', '£FK', 2],
            ['FOK', 'Faroese Króna', 'kr', 2],
            ['GBP', 'British Pound', '£', 2],
            ['GEL', 'Georgian Lari', '₾', 2],
            ['GGP', 'Guernsey Pound', '£', 2],
            ['GHS', 'Ghanaian Cedi', 'GH₵', 2],
            ['GIP', 'Gibraltar Pound', '£GI', 2],
            ['GMD', 'Gambian Dalasi', 'D', 2],
            ['GNF', 'Guinean Franc', 'FG', 0],
            ['GTQ', 'Guatemalan Quetzal', 'Q', 2],
            ['GYD', 'Guyanaese Dollar', '$', 2],
            ['HKD', 'Hong Kong Dollar', 'HK$', 2],
            ['HNL', 'Honduran Lempira', 'L', 2],
            ['HRK', 'Croatian Kuna', 'kn', 2],
            ['HTG', 'Haitian Gourde', 'G', 2],
            ['HUF', 'Hungarian Forint', 'Ft', 2],
            ['IDR', 'Indonesian Rupiah', 'Rp', 2],
            ['ILS', 'Israeli New Shekel', '₪', 2],
            ['IMP', 'Isle of Man Pound', '£', 2],
            ['INR', 'Indian Rupee', '₹', 2],
            ['IQD', 'Iraqi Dinar', null, 3],
            ['IRR', 'Iranian Rial', 'ر.إ.', 2],
            ['ISK', 'Icelandic Króna', 'Ikr', 0],
            ['JEP', 'Jersey Pound', '£', 2],
            ['JMD', 'Jamaican Dollar', 'JM$', 2],
            ['JOD', 'Jordanian Dinar', null, 3],
            ['JPY', 'Japanese Yen', '¥', 0],
            ['KES', 'Kenyan Shilling', 'Ksh', 2],
            ['KGS', 'Kyrgystani Som', 'сом', 2],
            ['KHR', 'Cambodian Riel', '៛', 2],
            ['KID', 'Kiribati Dollar', '$', 2],
            ['KMF', 'Comorian Franc', 'CF', 0],
            ['KRW', 'South Korean Won', '₩', 0],
            ['KWD', 'Kuwaiti Dinar', null, 3],
            ['KYD', 'Cayman Islands Dollar', '$', 2],
            ['KZT', 'Kazakhstani Tenge', '₸', 2],
            ['LAK', 'Laotian Kip', '₭', 2],
            ['LBP', 'Lebanese Pound', '£LB', 2],
            ['LKR', 'Sri Lankan Rupee', 'රු.', 2],
            ['LRD', 'Liberian Dollar', '$', 2],
            ['LSL', 'Lesotho Loti', 'ЛСЛ', 2],
            ['LYD', 'Libyan Dinar', 'ߟߓߘ', 3],
            ['MAD', 'Moroccan Dirham', 'ߡߘߤ', 2],
            ['MDL', 'Moldovan Leu', 'L', 2],
            ['MGA', 'Malagasy Ariary', 'Ar', 2],
            ['MKD', 'Macedonian Denar', 'ден.', 2],
            ['MMK', 'Myanmar Kyat', 'K', 2],
            ['MNT', 'Mongolian Tugrik', '₮', 2],
            ['MOP', 'Macanese Pataca', 'MOP$', 2],
            ['MRU', 'Mauritanian Ouguiya', 'أ.م.', 2],
            ['MUR', 'Mauritian Rupee', 'Rs', 2],
            ['MVR', 'Maldivian Rufiyaa', 'Rf', 2],
            ['MWK', 'Malawian Kwacha', 'ߡߟߞ', 2],
            ['MXN', 'Mexican Peso', 'MX$', 2],
            ['MYR', 'Malaysian Ringgit', 'RM', 2],
            ['MZN', 'Mozambican Metical', 'MTn', 2],
            ['NAD', 'Namibian Dollar', '$NA', 2],
            ['NGN', 'Nigerian Naira', '₦', 2],
            ['NIO', 'Nicaraguan Córdoba', 'C$', 2],
            ['NOK', 'Norwegian Krone', 'kr', 2],
            ['NPR', 'Nepalese Rupee', 'नेरू', 2],
            ['NZD', 'New Zealand Dollar', 'NZ$', 2],
            ['OMR', 'Omani Rial', null, 3],
            ['PAB', 'Panamanian Balboa', 'B/.', 2],
            ['PEN', 'Peruvian Sol', 'S/', 2],
            ['PGK', 'Papua New Guinean Kina', '𞤑𞤆𞤘', 2],
            ['PHP', 'Philippine Peso', '₱', 2],
            ['PKR', 'Pakistani Rupee', 'Rs', 2],
            ['PLN', 'Polish Zloty', 'zł', 2],
            ['PYG', 'Paraguayan Guarani', 'Gs.', 0],
            ['QAR', 'Qatari Riyal', null, 2],
            ['RON', 'Romanian Leu', 'रॉन', 2],
            ['RSD', 'Serbian Dinar', 'din.', 2],
            ['RUB', 'Russian Ruble', '₽', 2],
            ['RWF', 'Rwandan Franc', 'RF', 0],
            ['SAR', 'Saudi Riyal', null, 2],
            ['SBD', 'Solomon Islands Dollar', '$SB', 2],
            ['SCR', 'Seychellois Rupee', 'SR', 2],
            ['SDG', 'Sudanese Pound', 'ج.س.', 2],
            ['SEK', 'Swedish Krona', 'kr', 2],
            ['SGD', 'Singapore Dollar', '$SG', 2],
            ['SHP', 'St. Helena Pound', 'ߛߤߔ', 2],
            ['SLE', 'Sierra Leonean Leone', 'Le', 2],
            ['SLL', 'Sierra Leonean Leone (1964—2022)', null, 2],
            ['SOS', 'Somali Shilling', 'S', 2],
            ['SRD', 'Surinamese Dollar', '$SR', 2],
            ['SSP', 'South Sudanese Pound', '£', 2],
            ['STN', 'São Tomé & Príncipe Dobra', 'ߛߔߘ', 2],
            ['SYP', 'Syrian Pound', 'LS', 2],
            ['SZL', 'Swazi Lilangeni', 'ߛߖ߭ߟ', 2],
            ['THB', 'Thai Baht', '฿', 2],
            ['TJS', 'Tajikistani Somoni', 'сом.', 2],
            ['TMT', 'Turkmenistani Manat', 'ТМТ', 2],
            ['TND', 'Tunisian Dinar', 'ߕߣߘ', 3],
            ['TOP', 'Tongan Paʻanga', 'T$', 2],
            ['TRY', 'Turkish Lira', '₺', 2],
            ['TTD', 'Trinidad & Tobago Dollar', '$TT', 2],
            ['TVD', 'Tuvaluan Dollar', '$', 2],
            ['TWD', 'New Taiwan Dollar', 'NT$', 2],
            ['TZS', 'Tanzanian Shilling', 'TSh', 2],
            ['UAH', 'Ukrainian Hryvnia', '₴', 2],
            ['UGX', 'Ugandan Shilling', 'USh', 0],
            ['USD', 'US Dollar', '$', 2],
            ['UYU', 'Uruguayan Peso', '$UY', 2],
            ['UZS', 'Uzbekistani Som', 'soʻm', 2],
            ['VES', 'Venezuelan Bolívar', 'Bs.S', 2],
            ['VND', 'Vietnamese Dong', '₫', 0],
            ['VUV', 'Vanuatu Vatu', 'VT', 0],
            ['WST', 'Samoan Tala', '$WS', 2],
            ['XAF', 'Central African CFA Franc', 'FCFA', 0],
            ['XCD', 'East Caribbean Dollar', 'EC$', 2],
            ['XCG', 'Caribbean guilder', 'Cg.', 2],
            ['XDR', 'Special Drawing Rights', 'DIP', 2],
            ['XOF', 'West African CFA Franc', 'F CFA', 0],
            ['XPF', 'CFP Franc', 'CFPF', 0],
            ['YER', 'Yemeni Rial', null, 2],
            ['ZAR', 'South African Rand', 'R', 2],
            ['ZMW', 'Zambian Kwacha', 'K', 2],
            ['ZWG', 'Zimbabwe Gold', 'ZiG', 2],
            ['ZWL', 'Zimbabwean Dollar (2009)', 'ߖ߭ߥߟ', 2],
        ];
    }
}
