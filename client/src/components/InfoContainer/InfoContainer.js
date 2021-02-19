import React, { Component } from "react";
// import Container from "./Container";
// import SearchForm from "./SearchForm/SearchForm";
import HitCard from "../HitCard/HitCard";
import Container from "@material-ui/core/Container";
import Ticker from "../Ticker/Ticker";

import API from "../../utils/API";

class InfoContainer extends Component {
  //   state = {
  //     hits: [],
  //     // filterRun: [],
  //     // nameSort: 0,
  //     // search: "",
  //   };

  //   componentDidMount() {
  //     API.getTopHits().then((res) => {
  //       const hits = res.data.data.children.map((obj) => obj.data);
  //       this.setState({ hits });
  //     });
  //   }

  // handleInputChange = (event) => {
  //     const { value } = event.target;
  //     const filterRun = this.state.employees.filter((emp) =>
  //       emp.email.includes(value));
  //       this.setState({
  //         search: value, filterRun,
  //       });
  //     };

  render() {
    return (
      <Container maxWidth="sm">
        <div>
          <Ticker />
          {/* <SearchForm
                searchInput={this.state.search}
                handleInputChange={this.handleInputChange}
                filterRes={this.sorting}
            /> */}
        </div>
        <div>
          <h2>Trending Hits</h2>
          <HitCard />
        </div>
      </Container>
    );
  }
}

export default InfoContainer;
