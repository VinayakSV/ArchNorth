import { useState, useEffect, useRef, useCallback, memo } from 'react';
import {
  Box, Button, Typography, Chip, CircularProgress, Alert,
  IconButton, Tooltip, Select, MenuItem, FormControl, InputLabel,
  Collapse, useTheme, Paper,
} from '@mui/material';
import {
  PlayArrow, Refresh, ContentCopy, ExpandMore, ExpandLess,
  TableChart, CheckCircle, ErrorOutline,
} from '@mui/icons-material';
import sqlWasmUrl from 'sql.js/dist/sql-wasm-browser.wasm?url';
import AppLoader from './AppLoader';

// ── Sample queries shown in the quick-pick dropdown ──────────────────────────
const SAMPLE_QUERIES = [
  { label: '— Quick queries —', sql: '' },
  { label: 'All airlines', sql: 'SELECT * FROM airlines ORDER BY name;' },
  { label: 'All airports (India)', sql: "SELECT iata_code, name, city FROM airports WHERE country = 'India' ORDER BY city;" },
  { label: 'All flights', sql: 'SELECT flight_number, status, aircraft, seats_booked, seats_total FROM flights ORDER BY departure_time LIMIT 20;' },
  { label: 'Passengers (gold/platinum)', sql: "SELECT first_name || ' ' || last_name AS name, tier, total_miles FROM passengers WHERE tier IN ('gold','platinum') ORDER BY total_miles DESC;" },
  { label: 'Bookings with fare', sql: 'SELECT booking_id, class, fare, status FROM bookings ORDER BY fare DESC LIMIT 15;' },
  { label: 'Flights + route info (JOIN)', sql: `SELECT f.flight_number, al.code AS airline,
       a1.iata_code AS origin, a2.iata_code AS dest,
       f.status, f.seats_booked, f.seats_total
FROM flights f
JOIN routes r  ON f.route_id = r.route_id
JOIN airlines al ON r.airline_id = al.airline_id
JOIN airports a1 ON r.origin_id = a1.airport_id
JOIN airports a2 ON r.dest_id = a2.airport_id
ORDER BY f.departure_time LIMIT 15;` },
  { label: 'Revenue by airline (GROUP BY)', sql: `SELECT al.name AS airline, al.code,
       COUNT(b.booking_id) AS total_bookings,
       ROUND(SUM(b.fare), 2) AS total_revenue,
       ROUND(AVG(b.fare), 2) AS avg_fare
FROM bookings b
JOIN flights f  ON b.flight_id = f.flight_id
JOIN routes r   ON f.route_id = r.route_id
JOIN airlines al ON r.airline_id = al.airline_id
WHERE b.status = 'confirmed'
GROUP BY al.airline_id, al.name, al.code
ORDER BY total_revenue DESC;` },
  { label: 'Passenger booking count (subquery)', sql: `SELECT p.first_name || ' ' || p.last_name AS passenger,
       p.tier,
       (SELECT COUNT(*) FROM bookings b WHERE b.passenger_id = p.passenger_id) AS total_bookings,
       (SELECT COALESCE(SUM(fare),0) FROM bookings b WHERE b.passenger_id = p.passenger_id AND b.status='confirmed') AS total_spent
FROM passengers p
ORDER BY total_spent DESC LIMIT 10;` },
  { label: 'Revenue rank by route (Window)', sql: `SELECT al.code || f.flight_number AS flight,
       a1.iata_code || '→' || a2.iata_code AS route,
       COUNT(b.booking_id) AS bookings,
       ROUND(SUM(b.fare), 0) AS revenue,
       RANK() OVER (ORDER BY SUM(b.fare) DESC) AS revenue_rank
FROM bookings b
JOIN flights f  ON b.flight_id = f.flight_id
JOIN routes r   ON f.route_id = r.route_id
JOIN airlines al ON r.airline_id = al.airline_id
JOIN airports a1 ON r.origin_id = a1.airport_id
JOIN airports a2 ON r.dest_id = a2.airport_id
WHERE b.status = 'confirmed'
GROUP BY f.flight_id, al.code, f.flight_number, a1.iata_code, a2.iata_code
ORDER BY revenue DESC LIMIT 12;` },
  { label: 'Load factor per flight', sql: `SELECT f.flight_number,
       a1.iata_code || '→' || a2.iata_code AS route,
       f.seats_booked, f.seats_total,
       ROUND(CAST(f.seats_booked AS REAL) / f.seats_total * 100, 1) AS load_factor_pct
FROM flights f
JOIN routes r  ON f.route_id = r.route_id
JOIN airports a1 ON r.origin_id = a1.airport_id
JOIN airports a2 ON r.dest_id = a2.airport_id
WHERE f.status != 'cancelled'
ORDER BY load_factor_pct DESC;` },
];

// ── Database schema and seed data (SQLite compatible) ─────────────────────────
export const INIT_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE airlines (
  airline_id INTEGER PRIMARY KEY,
  code       TEXT NOT NULL,
  name       TEXT NOT NULL,
  country    TEXT,
  founded    INTEGER,
  fleet_size INTEGER,
  hub        TEXT
);

CREATE TABLE airports (
  airport_id INTEGER PRIMARY KEY,
  iata_code  TEXT UNIQUE NOT NULL,
  name       TEXT NOT NULL,
  city       TEXT NOT NULL,
  country    TEXT NOT NULL,
  timezone   TEXT
);

CREATE TABLE routes (
  route_id    INTEGER PRIMARY KEY,
  airline_id  INTEGER REFERENCES airlines(airline_id),
  origin_id   INTEGER REFERENCES airports(airport_id),
  dest_id     INTEGER REFERENCES airports(airport_id),
  distance_km INTEGER
);

CREATE TABLE flights (
  flight_id      INTEGER PRIMARY KEY,
  route_id       INTEGER REFERENCES routes(route_id),
  flight_number  TEXT NOT NULL,
  departure_time TEXT,
  arrival_time   TEXT,
  status         TEXT DEFAULT 'scheduled',
  aircraft       TEXT,
  seats_total    INTEGER,
  seats_booked   INTEGER DEFAULT 0
);

CREATE TABLE passengers (
  passenger_id INTEGER PRIMARY KEY,
  first_name   TEXT NOT NULL,
  last_name    TEXT NOT NULL,
  email        TEXT UNIQUE NOT NULL,
  nationality  TEXT,
  tier         TEXT DEFAULT 'bronze',
  total_miles  INTEGER DEFAULT 0,
  joined_date  TEXT
);

CREATE TABLE bookings (
  booking_id   INTEGER PRIMARY KEY,
  passenger_id INTEGER REFERENCES passengers(passenger_id),
  flight_id    INTEGER REFERENCES flights(flight_id),
  booking_date TEXT,
  seat         TEXT,
  class        TEXT DEFAULT 'economy',
  fare         REAL NOT NULL,
  status       TEXT DEFAULT 'confirmed',
  checked_in   INTEGER DEFAULT 0
);

-- ── AIRLINES ─────────────────────────────────────────────────────────────────
INSERT INTO airlines VALUES
  (1,'AI','Air India','India',1932,128,'DEL'),
  (2,'6E','IndiGo','India',2006,330,'DEL'),
  (3,'UK','Vistara','India',2015,53,'DEL'),
  (4,'EK','Emirates','UAE',1985,261,'DXB'),
  (5,'BA','British Airways','UK',1974,281,'LHR');

-- ── AIRPORTS ─────────────────────────────────────────────────────────────────
INSERT INTO airports VALUES
  (1,'DEL','Indira Gandhi International','Delhi','India','Asia/Kolkata'),
  (2,'BOM','Chhatrapati Shivaji Maharaj International','Mumbai','India','Asia/Kolkata'),
  (3,'BLR','Kempegowda International','Bangalore','India','Asia/Kolkata'),
  (4,'HYD','Rajiv Gandhi International','Hyderabad','India','Asia/Kolkata'),
  (5,'MAA','Chennai International','Chennai','India','Asia/Kolkata'),
  (6,'CCU','Netaji Subhas Chandra Bose International','Kolkata','India','Asia/Kolkata'),
  (7,'DXB','Dubai International','Dubai','UAE','Asia/Dubai'),
  (8,'LHR','Heathrow Airport','London','UK','Europe/London'),
  (9,'JFK','John F Kennedy International','New York','USA','America/New_York'),
  (10,'SIN','Singapore Changi Airport','Singapore','Singapore','Asia/Singapore');

-- ── ROUTES ───────────────────────────────────────────────────────────────────
INSERT INTO routes VALUES
  (1, 1,1,2,1148), (2, 1,1,3,1740), (3, 1,1,4,1255), (4, 1,1,5,1760),
  (5, 1,1,6,1305), (6, 1,1,7,2207), (7, 1,1,8,6718),
  (8, 2,1,2,1148), (9, 2,1,3,1740),(10, 2,2,3,844),
  (11,2,2,4,711), (12,2,1,4,1255),(13,2,1,10,4150),
  (14,3,1,2,1148),(15,3,1,3,1740),(16,3,1,4,1255),
  (17,4,7,1,2207),(18,4,7,2,1932),(19,4,7,3,2073),
  (20,5,8,1,6718),(21,5,8,2,7180);

-- ── FLIGHTS ──────────────────────────────────────────────────────────────────
INSERT INTO flights VALUES
  (1, 1,'AI101','2025-06-01 06:00','2025-06-01 07:55','departed','A320',168,162),
  (2, 1,'AI103','2025-06-01 11:30','2025-06-01 13:25','scheduled','A321',180,145),
  (3, 1,'AI105','2025-06-01 17:00','2025-06-01 18:55','scheduled','B737',160,98),
  (4, 2,'AI201','2025-06-01 07:15','2025-06-01 09:30','arrived','A320',168,168),
  (5, 2,'AI203','2025-06-01 14:00','2025-06-01 16:15','delayed','A321',180,172),
  (6, 3,'AI301','2025-06-01 08:00','2025-06-01 10:05','scheduled','B737',160,132),
  (7, 4,'AI401','2025-06-01 09:30','2025-06-01 11:45','scheduled','A320',168,88),
  (8, 5,'AI501','2025-06-01 06:45','2025-06-01 09:00','arrived','B737',160,155),
  (9, 6,'AI601','2025-06-01 10:00','2025-06-01 12:30','scheduled','A321',180,67),
  (10,7,'AI021','2025-06-01 14:00','2025-06-01 18:30','scheduled','B787',296,241),
  (11,8,'6E201','2025-06-01 06:30','2025-06-01 08:25','arrived','A320',180,180),
  (12,8,'6E203','2025-06-01 12:00','2025-06-01 13:55','scheduled','A320',180,167),
  (13,8,'6E205','2025-06-01 19:00','2025-06-01 20:55','scheduled','A321',186,142),
  (14,9,'6E401','2025-06-01 07:00','2025-06-01 09:15','departed','A320',180,175),
  (15,10,'6E501','2025-06-01 09:00','2025-06-01 10:25','scheduled','A320',180,89),
  (16,11,'6E601','2025-06-01 11:00','2025-06-01 12:15','cancelled','A320',180,0),
  (17,12,'6E701','2025-06-01 15:00','2025-06-01 17:05','scheduled','A321',186,178),
  (18,13,'6E081','2025-06-01 23:00','2025-06-02 10:30','scheduled','A321',186,154),
  (19,14,'UK101','2025-06-01 07:30','2025-06-01 09:25','scheduled','A320',158,121),
  (20,15,'UK201','2025-06-01 13:00','2025-06-01 15:15','delayed','A321',165,160),
  (21,16,'UK301','2025-06-01 18:00','2025-06-01 20:05','scheduled','A320',158,43),
  (22,17,'EK501','2025-06-01 03:35','2025-06-01 08:25','arrived','B777',354,312),
  (23,17,'EK503','2025-06-01 14:50','2025-06-01 19:40','scheduled','A380',517,498),
  (24,18,'EK511','2025-06-01 04:10','2025-06-01 08:25','arrived','B777',354,287),
  (25,19,'EK521','2025-06-01 05:00','2025-06-01 09:25','departed','B777',354,341),
  (26,20,'BA001','2025-06-01 21:15','2025-06-02 11:00','scheduled','B787',216,189),
  (27,20,'BA003','2025-06-01 09:30','2025-06-02 23:15','delayed','B777',280,211),
  (28,21,'BA101','2025-06-01 22:00','2025-06-02 12:30','scheduled','B787',216,143);

-- ── PASSENGERS ───────────────────────────────────────────────────────────────
INSERT INTO passengers VALUES
  (1,'Vinayak','Sharma','vinayak@example.com','Indian','platinum',145200,'2018-03-15'),
  (2,'Priya','Kapoor','priya.k@example.com','Indian','gold',82300,'2019-07-22'),
  (3,'Rahul','Mehta','rahul.m@example.com','Indian','silver',38500,'2020-01-10'),
  (4,'Anita','Reddy','anita.r@example.com','Indian','gold',91500,'2017-11-05'),
  (5,'Kiran','Patel','kiran.p@example.com','Indian','platinum',203400,'2016-06-18'),
  (6,'James','Wilson','james.w@example.com','British','silver',47200,'2020-08-30'),
  (7,'Emma','Thompson','emma.t@example.com','British','gold',78900,'2019-02-14'),
  (8,'Ahmed','Al-Rashid','ahmed.ar@example.com','UAE','platinum',188700,'2017-05-20'),
  (9,'Fatima','Hassan','fatima.h@example.com','UAE','silver',29300,'2021-03-08'),
  (10,'David','Chen','david.c@example.com','Singaporean','gold',95600,'2018-09-12'),
  (11,'Meera','Nair','meera.n@example.com','Indian','bronze',8200,'2022-06-01'),
  (12,'Arjun','Singh','arjun.s@example.com','Indian','silver',31500,'2021-01-20'),
  (13,'Sneha','Verma','sneha.v@example.com','Indian','bronze',4100,'2023-02-14'),
  (14,'Raj','Gupta','raj.g@example.com','Indian','gold',67800,'2019-10-31'),
  (15,'Aisha','Mohammed','aisha.m@example.com','UAE','silver',42600,'2020-05-17'),
  (16,'Carlos','Martinez','carlos.m@example.com','Spanish','bronze',9800,'2022-11-09'),
  (17,'Yuki','Tanaka','yuki.t@example.com','Japanese','gold',88200,'2018-07-25'),
  (18,'Sarah','Johnson','sarah.j@example.com','American','silver',35700,'2020-12-03'),
  (19,'Amit','Kumar','amit.k@example.com','Indian','platinum',167300,'2016-04-22'),
  (20,'Deepa','Iyer','deepa.i@example.com','Indian','gold',73200,'2019-08-15'),
  (21,'Rohan','Das','rohan.d@example.com','Indian','bronze',6300,'2023-01-07'),
  (22,'Suresh','Pillai','suresh.p@example.com','Indian','silver',25800,'2021-09-18'),
  (23,'Nina','Fernandes','nina.f@example.com','Indian','bronze',11200,'2022-04-30'),
  (24,'Omar','Sheikh','omar.s@example.com','UAE','gold',82100,'2018-12-21'),
  (25,'Pooja','Joshi','pooja.j@example.com','Indian','silver',44900,'2020-07-11'),
  (26,'Thomas','Williams','thomas.w@example.com','British','gold',91800,'2018-03-28'),
  (27,'Lakshmi','Rao','lakshmi.r@example.com','Indian','bronze',7600,'2023-05-02'),
  (28,'Hassan','Ali','hassan.a@example.com','UAE','silver',38100,'2020-10-14'),
  (29,'Anjali','Chopra','anjali.c@example.com','Indian','platinum',122400,'2017-08-09'),
  (30,'Wei','Zhang','wei.z@example.com','Singaporean','silver',51300,'2020-03-26');

-- ── BOOKINGS ─────────────────────────────────────────────────────────────────
INSERT INTO bookings VALUES
  (1,  1, 10,'2025-05-01 09:15','3A','business',85000,'confirmed',1),
  (2,  1, 26,'2025-05-15 14:30','2C','first',145000,'confirmed',0),
  (3,  2, 22,'2025-05-10 11:00','12B','business',62000,'confirmed',1),
  (4,  2, 23,'2025-05-20 16:45','15D','business',68000,'confirmed',0),
  (5,  3, 1, '2025-05-05 08:30','24A','economy',5800,'confirmed',1),
  (6,  3, 11,'2025-05-18 12:00','18C','economy',4200,'confirmed',0),
  (7,  4, 5, '2025-05-08 10:15','7B','economy',5200,'confirmed',1),
  (8,  4, 14,'2025-05-22 09:00','11A','economy',6100,'confirmed',0),
  (9,  5, 25,'2025-05-03 07:45','6C','business',48000,'confirmed',1),
  (10, 5, 17,'2025-05-17 15:30','9D','economy',7800,'confirmed',0),
  (11, 6, 22,'2025-05-12 13:20','21B','economy',38500,'confirmed',1),
  (12, 6, 24,'2025-05-25 10:00','14A','economy',39000,'confirmed',0),
  (13, 7, 26,'2025-05-06 11:45','4C','business',112000,'confirmed',1),
  (14, 7, 27,'2025-05-19 08:30','3B','business',98000,'confirmed',0),
  (15, 8, 23,'2025-05-14 16:00','22D','economy',52000,'confirmed',1),
  (16, 8, 18,'2025-05-28 12:30','17A','economy',7200,'confirmed',0),
  (17, 9, 22,'2025-05-07 09:00','8B','economy',38500,'confirmed',1),
  (18, 9, 24,'2025-05-21 14:15','13C','economy',39000,'confirmed',0),
  (19,10, 10,'2025-05-11 10:30','5A','first',198000,'confirmed',1),
  (20,10, 25,'2025-05-24 11:00','2D','business',88000,'confirmed',0),
  (21,11, 1, '2025-05-02 07:15','28B','economy',3800,'confirmed',1),
  (22,11, 11,'2025-05-16 13:00','19A','economy',3500,'confirmed',0),
  (23,12, 3, '2025-05-09 09:45','22C','economy',4500,'confirmed',1),
  (24,12, 12,'2025-05-23 15:30','15B','economy',4200,'confirmed',0),
  (25,13, 5, '2025-05-13 11:15','17D','economy',4100,'confirmed',1),
  (26,13, 13,'2025-05-27 08:00','24A','economy',3900,'confirmed',0),
  (27,14, 2, '2025-05-04 10:00','11C','economy',4800,'confirmed',1),
  (28,14, 19,'2025-05-18 16:45','9B','economy',3700,'confirmed',0),
  (29,15, 4, '2025-05-08 12:30','14D','economy',5500,'confirmed',1),
  (30,15, 20,'2025-05-22 09:15','21A','economy',5100,'confirmed',0),
  (31,16, 6, '2025-05-06 08:00','18B','business',34000,'confirmed',1),
  (32,16, 17,'2025-05-20 14:00','7C','economy',6800,'confirmed',0),
  (33,17, 8, '2025-05-10 11:30','4A','economy',48000,'confirmed',1),
  (34,17, 24,'2025-05-24 10:45','16D','economy',45000,'confirmed',0),
  (35,18, 10,'2025-05-14 09:00','2B','business',135000,'confirmed',1),
  (36,18, 19,'2025-05-28 15:30','5C','business',128000,'confirmed',0),
  (37,19, 1, '2025-05-03 07:30','25D','economy',5300,'confirmed',1),
  (38,19, 22,'2025-05-17 12:00','12A','economy',4900,'confirmed',0),
  (39,20, 3, '2025-05-07 10:15','22B','economy',5700,'confirmed',1),
  (40,20, 17,'2025-05-21 13:30','18C','economy',5200,'confirmed',0),
  (41,21, 5, '2025-05-11 08:45','29A','economy',6200,'cancelled',0),
  (42,21, 13,'2025-05-25 11:00','23D','economy',5900,'confirmed',0),
  (43,22, 4, '2025-05-05 09:30','8C','economy',38000,'confirmed',1),
  (44,22, 14,'2025-05-19 14:15','19B','economy',36000,'confirmed',0),
  (45,23, 8, '2025-05-09 12:00','3A','business',75000,'confirmed',1),
  (46,23, 24,'2025-05-23 10:30','2D','business',72000,'confirmed',0),
  (47,24, 10,'2025-05-13 07:45','5B','economy',39000,'confirmed',1),
  (48,24, 24,'2025-05-27 13:00','14C','economy',37500,'confirmed',0),
  (49,25, 2, '2025-05-04 11:15','7A','economy',35000,'confirmed',1),
  (50,25, 15,'2025-05-18 15:00','21B','economy',32000,'confirmed',0),
  (51,26, 1, '2025-05-08 09:00','4D','business',89000,'confirmed',1),
  (52,26, 5, '2025-05-22 12:45','8C','business',92000,'confirmed',0),
  (53,27, 8, '2025-05-12 10:30','15A','economy',58000,'confirmed',1),
  (54,27, 19,'2025-05-26 08:15','22D','business',95000,'confirmed',0),
  (55,28, 4, '2025-05-06 11:00','11B','economy',52000,'confirmed',1),
  (56,28, 10,'2025-05-20 14:30','6A','business',118000,'confirmed',0),
  (57, 1, 2, '2025-05-02 08:00','9C','economy',4500,'confirmed',1),
  (58, 2, 3, '2025-05-16 13:30','24B','economy',4100,'confirmed',0),
  (59, 3, 4, '2025-05-10 10:00','16A','economy',3900,'confirmed',1),
  (60, 4, 6, '2025-05-24 09:15','28C','economy',4700,'confirmed',0),
  (61, 5, 7, '2025-05-14 11:45','20B','economy',6800,'confirmed',1),
  (62, 6, 9, '2025-05-28 14:00','13D','economy',4300,'confirmed',0),
  (63, 7, 11,'2025-05-07 08:30','5C','economy',3600,'confirmed',1),
  (64, 8, 12,'2025-05-21 11:15','17B','economy',4100,'confirmed',0),
  (65, 9, 14,'2025-05-15 09:45','22A','economy',4800,'confirmed',1),
  (66,10, 16,'2025-05-29 13:30','9D','economy',5300,'confirmed',0),
  (67,11, 18,'2025-05-11 10:00','14C','economy',3700,'confirmed',1),
  (68,12, 20,'2025-05-25 08:45','19A','economy',4200,'confirmed',0),
  (69,13, 21,'2025-05-09 12:15','26B','economy',3500,'confirmed',1),
  (70,14, 23,'2025-05-23 15:00','11D','economy',5100,'confirmed',0),
  (71,15, 25,'2025-05-13 10:30','8A','economy',4600,'confirmed',1),
  (72,16, 27,'2025-05-27 09:00','23C','economy',6100,'confirmed',0),
  (73,17, 28,'2025-05-17 11:30','14B','economy',6400,'confirmed',1),
  (74,18, 18,'2025-05-31 14:45','7D','economy',6700,'confirmed',0),
  (75,19, 1, '2025-05-21 08:15','4A','economy',3800,'refunded',0),
  (76,20, 2, '2025-05-05 12:00','18D','economy',4300,'confirmed',1),
  (77,21, 3, '2025-05-19 15:30','22B','economy',5200,'confirmed',0),
  (78,22, 4, '2025-05-09 09:15','9C','economy',36500,'confirmed',1),
  (79,23, 5, '2025-05-23 13:00','2A','economy',38000,'confirmed',0),
  (80,24, 7, '2025-05-13 11:45','15D','economy',37000,'confirmed',1),
  (81,25, 9, '2025-05-27 08:30','6B','economy',34500,'confirmed',0),
  (82,26, 11,'2025-05-17 10:00','21C','business',87000,'confirmed',1),
  (83,27, 13,'2025-05-01 14:15','3D','economy',59000,'confirmed',0),
  (84,28, 15,'2025-05-15 09:30','10A','economy',53000,'confirmed',1),
  (85,29, 17,'2025-05-29 12:00','17C','economy',6900,'confirmed',0),
  (86,30, 18,'2025-05-12 11:15','24D','economy',5400,'confirmed',1);
`;

// ── Schema reference shown in the "Schema" panel ──────────────────────────────
const SCHEMA_INFO = [
  { table: 'airlines', cols: 'airline_id, code, name, country, founded, fleet_size, hub' },
  { table: 'airports', cols: 'airport_id, iata_code, name, city, country, timezone' },
  { table: 'routes', cols: 'route_id, airline_id, origin_id, dest_id, distance_km' },
  { table: 'flights', cols: 'flight_id, route_id, flight_number, departure_time, arrival_time, status, aircraft, seats_total, seats_booked' },
  { table: 'passengers', cols: 'passenger_id, first_name, last_name, email, nationality, tier, total_miles, joined_date' },
  { table: 'bookings', cols: 'booking_id, passenger_id, flight_id, booking_date, seat, class, fare, status, checked_in' },
];

// ── Result Table ──────────────────────────────────────────────────────────────
function ResultTable({ columns, rows, dark }) {
  if (!columns || columns.length === 0) return null;
  const headerBg = dark ? '#1e2a3a' : '#e3f2fd';
  const rowEvenBg = dark ? '#141c27' : '#f8f9fa';
  const borderColor = dark ? '#2a3a50' : '#dee2e6';

  return (
    <Box sx={{ overflowX: 'auto', borderRadius: 1, border: `1px solid ${borderColor}`, mt: 1 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'monospace' }}>
        <thead>
          <tr style={{ background: headerBg }}>
            {columns.map(col => (
              <th key={col} style={{
                padding: '6px 10px', textAlign: 'left', fontWeight: 700,
                borderBottom: `2px solid ${borderColor}`, color: dark ? '#90caf9' : '#1565c0',
                whiteSpace: 'nowrap',
              }}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} style={{ background: ri % 2 === 0 ? rowEvenBg : 'transparent' }}>
              {row.map((cell, ci) => (
                <td key={ci} style={{
                  padding: '5px 10px', borderBottom: `1px solid ${borderColor}`,
                  color: cell === null ? (dark ? '#546e7a' : '#9e9e9e') : 'inherit',
                  fontStyle: cell === null ? 'italic' : 'normal',
                  whiteSpace: 'nowrap', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {cell === null ? 'NULL' : String(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Box>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
const SqlPlayground = memo(function SqlPlayground() {
  const theme = useTheme();
  const dark = theme.palette.mode === 'dark';

  const [db, setDb] = useState(null);
  const [initError, setInitError] = useState(null);
  const [loading, setLoading] = useState(true);

  const [sql, setSql] = useState('-- Try a query, or pick one from the dropdown above\nSELECT * FROM airlines;');
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [queryTime, setQueryTime] = useState(null);
  const [running, setRunning] = useState(false);
  const [rowCount, setRowCount] = useState(null);

  const [schemaOpen, setSchemaOpen] = useState(false);
  const [selectedSample, setSelectedSample] = useState('');
  const textareaRef = useRef(null);

  // ── Init sql.js ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { default: initSqlJs } = await import('sql.js');
        // Bundled locally so the engine always matches the installed sql.js version and works offline
        const SQL = await initSqlJs({ locateFile: () => sqlWasmUrl });
        if (!mounted) return;
        const database = new SQL.Database();
        database.run(INIT_SQL);
        setDb(database);
      } catch (e) {
        if (mounted) setInitError(String(e));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // ── Run query ────────────────────────────────────────────────────────────────
  const runQuery = useCallback(() => {
    if (!db || !sql.trim()) return;
    setRunning(true);
    setError(null);
    setResults(null);

    try {
      const t0 = performance.now();
      const stmts = db.exec(sql);
      const elapsed = performance.now() - t0;

      if (stmts.length === 0) {
        setResults({ columns: [], rows: [] });
        setRowCount(0);
      } else {
        const last = stmts[stmts.length - 1];
        setResults({ columns: last.columns, rows: last.values });
        setRowCount(last.values.length);
      }
      setQueryTime(elapsed.toFixed(1));
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setRunning(false);
    }
  }, [db, sql]);

  // Ctrl+Enter shortcut
  const handleKeyDown = useCallback((e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      runQuery();
    }
  }, [runQuery]);

  const handleSampleChange = (e) => {
    const val = e.target.value;
    setSelectedSample(val);
    if (val) setSql(val);
  };

  const copyToClipboard = () => navigator.clipboard.writeText(sql);

  const editorBg = dark ? '#0d1117' : '#f6f8fa';
  const editorColor = dark ? '#e6edf3' : '#24292f';
  const borderColor = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.12)';

  return (
    <Box sx={{
      my: 3, borderRadius: 2.5, border: '1px solid', borderColor: 'divider',
      bgcolor: 'background.paper', overflow: 'hidden',
      boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
    }}>
      {/* Header */}
      <Box sx={{
        px: 2, py: 1.2, borderBottom: '1px solid', borderColor: 'divider',
        display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap',
        background: dark
          ? 'linear-gradient(90deg, rgba(33,150,243,0.10), transparent)'
          : 'linear-gradient(90deg, rgba(33,150,243,0.06), transparent)',
      }}>
        <TableChart sx={{ color: 'primary.main', fontSize: 20 }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 700, flex: 1, fontSize: '0.85rem' }}>
          SQL Playground — Airline Database
        </Typography>

        {/* Sample query dropdown */}
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <Select
            value={selectedSample}
            onChange={handleSampleChange}
            displayEmpty
            sx={{ fontSize: '0.75rem', height: 30 }}
          >
            {SAMPLE_QUERIES.map((q, i) => (
              <MenuItem key={i} value={q.sql} disabled={i === 0} sx={{ fontSize: '0.78rem' }}>
                {q.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Tooltip title="Toggle schema reference">
          <Chip
            icon={schemaOpen ? <ExpandLess sx={{ fontSize: 14 }} /> : <ExpandMore sx={{ fontSize: 14 }} />}
            label="Schema"
            size="small"
            variant="outlined"
            onClick={() => setSchemaOpen(o => !o)}
            sx={{ fontSize: '0.7rem', height: 26, cursor: 'pointer' }}
          />
        </Tooltip>
      </Box>

      {/* Schema panel */}
      <Collapse in={schemaOpen}>
        <Box sx={{
          px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider',
          bgcolor: dark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
          display: 'flex', flexWrap: 'wrap', gap: 1,
        }}>
          {SCHEMA_INFO.map(s => (
            <Box key={s.table} sx={{
              fontFamily: 'monospace', fontSize: 11.5,
              bgcolor: dark ? '#1a2535' : '#e8f4fd',
              border: '1px solid', borderColor: dark ? '#2a3a50' : '#b3d4f5',
              borderRadius: 1, px: 1.2, py: 0.8, minWidth: 160,
            }}>
              <Typography sx={{ fontWeight: 700, color: 'primary.main', fontSize: 12 }}>
                {s.table}
              </Typography>
              <Typography sx={{ color: 'text.secondary', fontSize: 10.5, mt: 0.25 }}>
                {s.cols}
              </Typography>
            </Box>
          ))}
        </Box>
      </Collapse>

      {/* Editor */}
      <Box sx={{ px: 2, pt: 1.5, pb: 1 }}>
        <Box sx={{ position: 'relative' }}>
          <textarea
            ref={textareaRef}
            value={sql}
            onChange={e => setSql(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={6}
            spellCheck={false}
            placeholder="Write your SQL query here…"
            style={{
              width: '100%', boxSizing: 'border-box',
              fontFamily: '"Fira Code","Cascadia Code","Consolas",monospace',
              fontSize: 13, lineHeight: 1.6,
              padding: '10px 12px', borderRadius: 6,
              border: `1px solid ${borderColor}`,
              background: editorBg, color: editorColor,
              outline: 'none', resize: 'vertical',
              minHeight: 110,
            }}
          />
        </Box>

        {/* Controls */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1, flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            size="small"
            startIcon={running ? <CircularProgress size={14} color="inherit" /> : <PlayArrow />}
            onClick={runQuery}
            disabled={!db || running || !sql.trim()}
            sx={{ fontWeight: 600, px: 2, height: 32, textTransform: 'none' }}
          >
            {running ? 'Running…' : 'Run Query'}
          </Button>

          <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.7rem' }}>
            Ctrl+Enter
          </Typography>

          <Tooltip title="Copy SQL">
            <IconButton size="small" onClick={copyToClipboard} sx={{ ml: 0.5 }}>
              <ContentCopy sx={{ fontSize: 15 }} />
            </IconButton>
          </Tooltip>

          <Tooltip title="Clear editor">
            <IconButton size="small" onClick={() => { setSql(''); setResults(null); setError(null); }}>
              <Refresh sx={{ fontSize: 15 }} />
            </IconButton>
          </Tooltip>

          {/* Status chips */}
          {queryTime !== null && !error && results && (
            <Box sx={{ display: 'flex', gap: 0.5, ml: 'auto', flexShrink: 0 }}>
              <Chip
                icon={<CheckCircle sx={{ fontSize: '0.8rem !important' }} />}
                label={`${rowCount} row${rowCount !== 1 ? 's' : ''}`}
                size="small" color="success" variant="outlined"
                sx={{ fontSize: '0.7rem', height: 22 }}
              />
              <Chip
                label={`${queryTime}ms`}
                size="small" variant="outlined"
                sx={{ fontSize: '0.7rem', height: 22 }}
              />
            </Box>
          )}
        </Box>
      </Box>

      {/* Init state messages */}
      {loading && (
        <AppLoader variant="inline" label="Loading SQL engine (sql.js WebAssembly)…" />
      )}
      {initError && (
        <Alert severity="error" sx={{ mx: 2, mb: 1.5, fontSize: '0.8rem' }}>
          Failed to load SQL engine: {initError}
        </Alert>
      )}

      {/* Error */}
      {error && (
        <Box sx={{ mx: 2, mb: 1.5, p: 1.5, borderRadius: 1.5, bgcolor: dark ? 'rgba(229,57,53,0.1)' : '#fff5f5', border: '1px solid', borderColor: dark ? 'rgba(229,57,53,0.3)' : '#fecdd3' }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
            <ErrorOutline sx={{ color: 'error.main', fontSize: 18, mt: 0.1, flexShrink: 0 }} />
            <Typography sx={{ fontFamily: 'monospace', fontSize: 12.5, color: 'error.main', whiteSpace: 'pre-wrap' }}>
              {error}
            </Typography>
          </Box>
        </Box>
      )}

      {/* Results */}
      {results && !error && (
        <Box sx={{ px: 2, pb: 2 }}>
          {results.columns.length === 0 ? (
            <Alert severity="success" sx={{ fontSize: '0.8rem' }}>Query executed successfully (no rows returned)</Alert>
          ) : (
            <ResultTable columns={results.columns} rows={results.rows} dark={dark} />
          )}
        </Box>
      )}

      {/* Footer */}
      <Box sx={{
        px: 2, py: 0.75, borderTop: '1px solid', borderColor: 'divider',
        bgcolor: dark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
        display: 'flex', gap: 1, flexWrap: 'wrap',
      }}>
        {['airlines(5)', 'airports(10)', 'routes(21)', 'flights(28)', 'passengers(30)', 'bookings(86)'].map(t => (
          <Chip key={t} label={t} size="small" variant="outlined"
            sx={{ fontSize: '0.65rem', height: 20, borderRadius: 1 }} />
        ))}
        <Typography variant="caption" sx={{ ml: 'auto', color: 'text.disabled', alignSelf: 'center', fontSize: '0.65rem' }}>
          In-browser SQLite · data resets on page reload
        </Typography>
      </Box>
    </Box>
  );
});

export default SqlPlayground;
