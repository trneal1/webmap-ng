// ===== CONFIG =====
const ALERTS_URL = "https://api.weather.gov/alerts/active";

const SETUP_SETTINGS_KEY = "nwsDashboardSetupSettings";
const PRIORITY_SETTINGS_KEY = "nwsDashboardPrioritySettings";
const DEFAULT_PRIORITY_ORDER = ["tornado-warning", "warning", "statement", "watch", "advisory", "other"];
const DEFAULT_PRIORITY_COLORS = {
    "tornado-warning":"#ff8c00",
    warning:"#ff0000",
    watch:"#ffff00",
    advisory:"#00aa00",
    statement:"#0000ff",
    other:"#800080"
};

const HISTORY_DB_NAME = "nwsDashboardHistory";
const HISTORY_DB_VERSION = 5;
const HISTORY_STORE_NAME = "snapshots";
const RADAR_TILE_STORE_NAME = "radarTiles";
const HISTORY_ALERT_HASH_STORE_NAME = "alertHashIndex";
const HISTORY_FRAME_DEDUP_MS = 60000;
const HISTORY_FRAME_CACHE_LIMIT = 30;
const HISTORY_MAP_SIDEBAR_CACHE_LIMIT = 8;

const RADAR_TILE_URL = "https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q/{z}/{x}/{y}.png";
const HISTORY_RADAR_WMS_URL = "https://mesonet.agron.iastate.edu/cgi-bin/wms/nexrad/n0r-t.cgi";
const HISTORY_RADAR_WMS_LAYER = "nexrad-n0r-wmst";

const PRECIP_WMS_URL = "https://mapservices.weather.noaa.gov/raster/services/obs/mrms_qpe/ImageServer/WMSServer";
const PRECIP_WMS_LAYERS = {
    "1h": "mrms_qpe:rft_1hr:unknown@gpml",
    "3h": "mrms_qpe:rft_3hr:unknown@gpml",
    "6h": "mrms_qpe:rft_6hr:unknown@gpml",
    "12h": "mrms_qpe:rft_12hr:unknown@gpml",
    "24h": "mrms_qpe:rft_24hr:unknown@gpml",
    "48h": "mrms_qpe:rft_48hr:unknown@gpml",
    "72h": "mrms_qpe:rft_72hr:unknown@gpml"
};
const PRECIP_TILE_RETRY_LIMIT = 2;
const PRECIP_REST_URL = "https://mapservices.weather.noaa.gov/raster/rest/services/obs/mrms_qpe/ImageServer";
const PRECIP_MM_PER_INCH = 25.4;

const LIGHTNING_WMS_URL = "https://nowcoast.noaa.gov/geoserver/ows";
const LIGHTNING_WMS_LAYER = "lightning_detection:ldn_lightning_strike_density";
const LIGHTNING_WMS_STYLE = "lightning_density";
const LIGHTNING_REFRESH_INTERVAL = 15 * 60 * 1000;
const LIGHTNING_TILE_RETRY_LIMIT = 2;

const CLOUD_WMS_URL = "https://nowcoast.noaa.gov/geoserver/ows";
const CLOUD_WMS_LAYER = "satellite:global_visible_imagery_mosaic";
const CLOUD_REFRESH_INTERVAL = 15 * 60 * 1000;
const CLOUD_TILE_RETRY_LIMIT = 2;
const CLOUD_LAYER_OPACITY = 0.55;

const stateAbbreviations = {
    "01":"AL","02":"AK","04":"AZ","05":"AR","06":"CA","08":"CO","09":"CT","10":"DE",
    "11":"DC","12":"FL","13":"GA","15":"HI","16":"ID","17":"IL","18":"IN","19":"IA",
    "20":"KS","21":"KY","22":"LA","23":"ME","24":"MD","25":"MA","26":"MI","27":"MN",
    "28":"MS","29":"MO","30":"MT","31":"NE","32":"NV","33":"NH","34":"NJ","35":"NM",
    "36":"NY","37":"NC","38":"ND","39":"OH","40":"OK","41":"OR","42":"PA","44":"RI",
    "45":"SC","46":"SD","47":"TN","48":"TX","49":"UT","50":"VT","51":"VA","53":"WA",
    "54":"WV","55":"WI","56":"WY"
};

const stateNameToAbbreviation = {
    "Alabama":"AL","Alaska":"AK","Arizona":"AZ","Arkansas":"AR","California":"CA","Colorado":"CO",
    "Connecticut":"CT","Delaware":"DE","District of Columbia":"DC","Florida":"FL","Georgia":"GA",
    "Hawaii":"HI","Idaho":"ID","Illinois":"IL","Indiana":"IN","Iowa":"IA","Kansas":"KS",
    "Kentucky":"KY","Louisiana":"LA","Maine":"ME","Maryland":"MD","Massachusetts":"MA",
    "Michigan":"MI","Minnesota":"MN","Mississippi":"MS","Missouri":"MO","Montana":"MT",
    "Nebraska":"NE","Nevada":"NV","New Hampshire":"NH","New Jersey":"NJ","New Mexico":"NM",
    "New York":"NY","North Carolina":"NC","North Dakota":"ND","Ohio":"OH","Oklahoma":"OK",
    "Oregon":"OR","Pennsylvania":"PA","Rhode Island":"RI","South Carolina":"SC",
    "South Dakota":"SD","Tennessee":"TN","Texas":"TX","Utah":"UT","Vermont":"VT",
    "Virginia":"VA","Washington":"WA","West Virginia":"WV","Wisconsin":"WI","Wyoming":"WY"
};

const WebmapConfig = Object.freeze({
    ALERTS_URL,
    SETUP_SETTINGS_KEY,
    PRIORITY_SETTINGS_KEY,
    DEFAULT_PRIORITY_ORDER,
    DEFAULT_PRIORITY_COLORS,
    HISTORY_DB_NAME,
    HISTORY_DB_VERSION,
    HISTORY_STORE_NAME,
    RADAR_TILE_STORE_NAME,
    HISTORY_ALERT_HASH_STORE_NAME,
    HISTORY_FRAME_DEDUP_MS,
    HISTORY_FRAME_CACHE_LIMIT,
    HISTORY_MAP_SIDEBAR_CACHE_LIMIT,
    RADAR_TILE_URL,
    HISTORY_RADAR_WMS_URL,
    HISTORY_RADAR_WMS_LAYER,
    PRECIP_WMS_URL,
    PRECIP_WMS_LAYERS,
    PRECIP_TILE_RETRY_LIMIT,
    PRECIP_REST_URL,
    PRECIP_MM_PER_INCH,
    LIGHTNING_WMS_URL,
    LIGHTNING_WMS_LAYER,
    LIGHTNING_WMS_STYLE,
    LIGHTNING_REFRESH_INTERVAL,
    LIGHTNING_TILE_RETRY_LIMIT,
    CLOUD_WMS_URL,
    CLOUD_WMS_LAYER,
    CLOUD_REFRESH_INTERVAL,
    CLOUD_TILE_RETRY_LIMIT,
    CLOUD_LAYER_OPACITY,
    stateAbbreviations,
    stateNameToAbbreviation
});
