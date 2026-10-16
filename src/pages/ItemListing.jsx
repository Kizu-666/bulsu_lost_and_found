import { useState } from 'react'
import useItems from '../hooks/useItems'
import ItemPhoto from '../components/ItemPhoto'
import { formatShortDate } from '../utils/formatDate'
import './styles/ItemListing.css'

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'lost', label: 'Lost' },
  { value: 'found', label: 'Found' },
  { value: 'claimed', label: 'Claimed' },
]

export default function ItemListing() {
  return (<h1>Item Listing</h1>)
}