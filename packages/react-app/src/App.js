import React, { useEffect, useState } from "react";
import { useWeb3React } from "@web3-react/core"
import { MAINNET_ID, addresses, abis } from "@sablier-app/contracts";
import { gql } from "apollo-boost";
import BigNumber from 'bignumber.js'
import { ethers } from "ethers";
import { useQuery } from "@apollo/react-hooks";
import DateTimePicker from 'react-datetime-picker';
import UncheckedJsonRpcSigner from './signer'
import "./App.css";

import { injected } from "./connectors"
import { useEagerConnect, useInactiveListener } from './hooks'

BigNumber.config({ EXPONENTIAL_AT: 30 })

const MY_STREAMS = gql`
query streams($account: String!) {
  senderStreams:streams(where: {sender: $account}){
    id
    recipient
    deposit
    startTime
    stopTime
  }
  recipientStreams:streams(where: {recipient: $account}) {
    id
    sender
    deposit
    startTime
    stopTime
  }
}
`

function getProviderOrSigner(library, account) {
  return account ? new UncheckedJsonRpcSigner(library.getSigner(account)) : library
}

function App() {

  const [deposit, setDeposit] = useState('')
  const [recipient, setRecipient] = useState('')
  const [startTime, setStartTime] = useState(new Date())
  const [stopTime, setStopTime] = useState(new Date())
  
  const context = useWeb3React();
  const {
    connector,
    library,
    chainId,
    account,
    activate,
  } = context;

  const { loading, error, data } = useQuery(MY_STREAMS, {variables: {account},})

  const [activatingConnector, setActivatingConnector] = useState({});
  useEffect(() => {
    if (activatingConnector && activatingConnector === connector) {
      setActivatingConnector(undefined);
    }
  }, [activatingConnector, connector]);

  // handle logic to eagerly connect to the injected ethereum provider, if it exists and has granted access already
  const triedEager = useEagerConnect();

  // handle logic to connect in reaction to certain events on the injected ethereum provider, if it exists
  useInactiveListener(!triedEager || !!activatingConnector);

  useEffect(() => {
    if (!loading && !error && data && data.streams) {
      console.log({ streams: data.streams });
    } else {

      console.log(data)
    }
  }, [loading, error, data]);

  function changeStartTime(date) {
    setStartTime(date)
  }

  function changeStopTime(date) {
    setStopTime(date)
  }
  
  function renderSenderStreams() {
    return data.senderStreams.map((stream) => {
      return(
        <React.Fragment key={stream.id}>
          <p><strong>StreamID: {stream.id}</strong></p>
          <p>Recipient: {stream.recipient}</p>
          <p>Deposit: {stream.deposit}</p>
          <p>Start Time: {stream.startTime}</p>
          <p>Stop Time: {stream.stopTime}</p>
          <button class="cancel-button" onClick={async() => {
            const sablier = new ethers.Contract(addresses[chainId].sablier, abis.sablier, getProviderOrSigner(library, account))
            const cancelTx = await sablier.cancel(stream.id); 
            await cancelTx.wait();
          }}>
            Cancel Stream
          </button>
        </React.Fragment>
      )
    })
  }

  function renderRecipientStreams() {
    return data.recipientStreams.map((stream) => {
      return(
        <React.Fragment key={stream.id}>
          <p><strong>StreamID: {stream.id}</strong></p>
          <p>Sender: {stream.sender}</p>
          <p>Deposit: {stream.deposit}</p>
          <p>Start Time: {stream.startTime}</p>
          <p>Stop Time: {stream.stopTime}</p>
          <button class="withdraw-button" onClick={async() => {
            const sablier = new ethers.Contract(addresses[chainId].sablier, abis.sablier, getProviderOrSigner(library, account))
            const withdrawTx = await sablier.withdraw(stream.id); 
            await withdrawTx.wait();
          }}>
            Withdraw from Stream
          </button>
        </React.Fragment>
      )
    })
  }

  return (
    <div className="App">
      <header className="App-header">
        <h1>Let's Create a Payment Stream!</h1>
          {context.active ? <p className="wallet-info">Wallet Connected: {account}</p> : 
          <button onClick={() => {
            setActivatingConnector(injected)
            activate(injected) 
          }}>Connect Wallet</button>
        }
        <div class="main-container">
          <div class="input-container">
            <input
              class="input"
              type="number"
              min="0"
              placeholder={'Enter deposit amount'}
              onChange={e => setDeposit(e.target.value)}
              onKeyPress={e => {
                const charCode = e.which ? e.which : e.keyCode

                // Prevent 'minus' character
                if (charCode === 45) {
                  e.preventDefault()
                  e.stopPropagation()
                }
              }}
              value={deposit}
            />
          </div>
          <div class="input-container">
            <input
              class="input"
              type="text"
              placeholder={'Recipient address'}
              onChange={e => setRecipient(e.target.value)}
              value={recipient}
            />
            </div>
            <div class="datetime-input-container"><p>Start Time (Local)</p><DateTimePicker onChange={(date) => changeStartTime(date)} value={startTime} /></div>
            <div class="datetime-input-container"><p>Stop Time (Local)</p><DateTimePicker onChange={(date) => changeStopTime(date)} value={stopTime} /></div>
            <div class="button-row">
              <button class="stream-button" onClick={async() => {
                const sablier = new ethers.Contract(addresses[chainId].sablier, abis.sablier, getProviderOrSigner(library, account))
                let convertedStartTime = Math.round(startTime.getTime() / 1000)
                let convertedStopTime = Math.round(stopTime.getTime() / 1000)
                let convertedDeposit = new BigNumber(deposit).multipliedBy(10 ** 18).toFixed(0)
                let remainder = new BigNumber(convertedDeposit) % (convertedStopTime - convertedStartTime)
                let amountToDeposit = new BigNumber(convertedDeposit).minus(remainder).toString()
                
                const token = new ethers.Contract("0xc3dbf84abb494ce5199d5d4d815b10ec29529ff8", abis.erc20, getProviderOrSigner(library, account)); 
                const approveTx = await token.approve(sablier.address, amountToDeposit); 
                await approveTx.wait();
                
                const createStreamTx = await sablier.createStream(recipient, amountToDeposit, token.address, convertedStartTime, convertedStopTime);
                await createStreamTx.wait();
              }}>Create Stream</button>
            </div>
            <hr/><hr/>
            <div class="streams-lists-container">
              <div class="streams-list">
                <h3>Streams I created</h3>
                {data ? renderSenderStreams() : null}
              </div>
              <div class="streams-list">
              <h3>Streams to Me</h3>
                {data ? renderRecipientStreams() : null}
              </div>
            </div>
          </div>
      </header>
    </div>
  );
}

export default App;
