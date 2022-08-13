const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const dbpath = path.join(__dirname, "covid19IndiaPortal.db");

let database = null;

const IntailizeDatabaseAndServer = async () => {
  try {
    database = await open({
      filename: dbpath,
      driver: sqlite3.Database,
    });

    app.listen(3000, () => {
      console.log("Database running at https://localhost:3000/");
    });
  } catch (error) {
    console.log(`DatabaseError : ${error.message}`);
    process.exit(1);
  }
};

IntailizeDatabaseAndServer();

//API 1

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const SelectedUserQuery = `SELECT * FROM user
   where username = '${username}';`;

  const seletedUser = await database.get(SelectedUserQuery);

  if (seletedUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordValid = await bcrypt.compare(
      password,
      seletedUser.password
    );
    if (isPasswordValid) {
      const payload = { username: username };
      const jwToken = jwt.sign(payload, "secretKey");
      response.send({ jwToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

// authenticateToken

const authenticateToken = (request, response, next) => {
  let jwtToken;

  const AuthHeader = request.headers["authorization"];
  if (AuthHeader !== undefined) {
    jwtToken = AuthHeader.split(" ")[1];
  }

  if (jwtToken !== undefined) {
    jwt.verify(jwtToken, "secretKey", (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  } else {
    response.status(401);
    response.send("Invalid JWT Token");
  }
};

//API 2  Returns a list of all states in the state table

app.get("/states/", authenticateToken, async (request, response) => {
  const GetStatesQuery = `SELECT * FROM state;`;
  const StatesQueryArray = await database.all(GetStatesQuery);

  let StatesArray = [];

  for (let eachstate of StatesQueryArray) {
    let stateobject = {
      stateId: eachstate.state_id,
      stateName: eachstate.state_name,
      population: eachstate.population,
    };

    StatesArray.push(stateobject);
  }

  response.send(StatesArray);
});

//API 3 Returns a state based on the state ID

app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const GetStatesQuery = `SELECT * FROM
   state
    WHERE 
      state_id = ${stateId};`;
  const State = await database.get(GetStatesQuery);
  let stateobject = {
    stateId: State.state_id,
    stateName: State.state_name,
    population: State.population,
  };

  response.send(stateobject);
});

// API 4 Create a district in the district table, district_id is auto-incremented

app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const createDistrictQuery = `
INSERT INTO 
    district (
        district_name ,	
        state_id,	
        cases,	
        cured,	
        active,	
        deaths)
VALUES 
    ('${districtName}' ,
    ${stateId} ,
    ${cases} ,
    ${cured} ,
    ${active},
    ${deaths});
`;

  await database.run(createDistrictQuery);
  response.send("District Successfully Added");
});

//API 5  Returns a district based on the district ID

app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const GetDistrict = `SELECT * 
    FROM
      district
    WHERE 
       district_id = ${districtId};`;

    const district = await database.get(GetDistrict);

    let object = {
      districtId: district.district_id,
      districtName: district.district_name,
      stateId: district.state_id,
      cases: district.cases,
      cured: district.cured,
      active: district.active,
      deaths: district.deaths,
    };
    response.send(object);
  }
);

// API 6  Deletes a district from the district table based on the district ID

app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `
  DELETE FROM
    district
  WHERE
    district_id = ${districtId} 
  `;
    await database.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

// API 7  Updates the details of a specific district based on the district ID

app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;

    const createDistrictQuery = `
    UPDATE
      district
    SET 
        district_name = '${districtName}' ,	
        state_id = ${stateId} ,
        cases = ${cases} ,
        cured = ${cured} ,
        active = ${active}, 
        deaths = ${deaths}
   WHERE
     district_id = ${districtId};`;

    await database.run(createDistrictQuery);
    response.send("District Details Updated");
  }
);

// API 8 Returns the statistics of total cases, cured, active, deaths of a specific state based on state ID

app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStateStatsQuery = `
    SELECT
      SUM(cases),
      SUM(cured),
      SUM(active),
      SUM(deaths)
    FROM
      district
    WHERE
      state_id=${stateId};`;
    const stats = await database.get(getStateStatsQuery);
    response.send({
      totalCases: stats["SUM(cases)"],
      totalCured: stats["SUM(cured)"],
      totalActive: stats["SUM(active)"],
      totalDeaths: stats["SUM(deaths)"],
    });
  }
);

module.exports = app;
