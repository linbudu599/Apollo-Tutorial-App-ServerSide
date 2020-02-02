const { RESTDataSource } = require("apollo-datasource-rest");

// 这个类也为我们封装了将响应缓存在内存中的逻辑 即partial query caching
class LaunchAPI extends RESTDataSource {
  constructor() {
    super();
    this.baseURL = "https://api.spacexdata.com/v2/";
  }

  async getAllLaunches() {
    // GET https://api.spacexdata.com/v2/launches
    const response = await this.get("launches");
    return Array.isArray(response)
      ? response.map(launch => this.launchReducer(launch))
      : [];
  }

  // transform launch data into the shape our schema expects
  launchReducer({
    flight_number,
    launch_date_unix,
    launch_site,
    mission_name,
    links,
    rocket
  }) {
    return {
      id: flight_number || 0,
      cursor: `${launch_date_unix}`,
      site: launch_site && launch_site.site_name,
      mission: {
        name: mission_name,
        missionPatchSmall: links.mission_patch_small,
        missionPatchLarge: links.mission_patch
      },
      rocket: {
        id: rocket.rocket_id,
        name: rocket.rocket_name,
        type: rocket.rocket_type
      }
    };
  }

  async getLaunchById({ launchId }) {
    const response = await this.get("launches", { flight_number: launchId });
    return this.launchReducer(response[0]);
  }

  getLaunchesByIds({ launchIds }) {
    return Promise.all(
      launchIds.map(launchId => this.getLaunchById({ launchId }))
    );
  }
}

module.exports = LaunchAPI;
