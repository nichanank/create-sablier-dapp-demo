import React from "react";
import ReactDOM from "react-dom";
import ApolloClient from "apollo-boost";
import { ApolloProvider } from "@apollo/react-hooks";
import { ethers } from "ethers";
import { Web3ReactProvider } from '@web3-react/core';
import "./index.css";
import App from "./App";

function getLibrary(provider) {
  const library = new ethers.providers.Web3Provider(provider)
  library.pollingInterval = 10000
  return library
}

// This is the official Sablier subgraph. You can replace it with your own, if you need to.
// See all subgraphs: https://thegraph.com/explorer/
const client = new ApolloClient({
  uri: "https://api.thegraph.com/subgraphs/name/sablierhq/sablier-rinkeby",
});

ReactDOM.render(
  <Web3ReactProvider getLibrary={getLibrary}>
          <ApolloProvider client={client}>
            <App />
          </ApolloProvider>
  </Web3ReactProvider>,
  document.getElementById("root"),
);
