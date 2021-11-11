import React, { Component } from 'react';
// import Container from "./Container";
// import SearchForm from "./SearchForm/SearchForm";
import HitCard from '../HitCard/HitCard';
import Container from '@material-ui/core/Container';
import Grid from '@material-ui/core/Grid';
import { getTopHits } from '../../utils/API';

class InfoContainer extends Component {
  state = {
    hits: []
  };


  componentDidMount() {
    getTopHits().then((res) => {
      this.setState({ hits: res.data });
    });
  }


  render() {
    return (
      <Container maxWidth='sm'>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <div>
              {/* <SearchForm
                searchInput={this.state.search}
                handleInputChange={this.handleInputChange}
                filterRes={this.sorting}
            /> */}
            </div>
            <div>
              <h2>Trending Hits</h2>
              {this.state.hits.map((hit) => {
                return (
                  <HitCard
                    key={hit.id}
                    id={hit.id}
                    symbol={hit.Company.symbol}
                    company={hit.Company.company}
                    link={hit.id}
                    date={hit.createdAt}
                  />
                );
              })}
            </div>
          </Grid>
        </Grid>
      </Container>
    );
  }
}

export default InfoContainer;
