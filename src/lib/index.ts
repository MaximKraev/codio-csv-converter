import * as csvParse from 'csv-parse'
import * as stringify from 'csv-stringify'
import * as streamTransform from 'stream-transform'
import * as fs from 'fs'
import * as base from './base'
import * as _ from 'lodash'

//const log = base.Logger.get('index')
const OPTIONS = {
  delimiter: ',',
  columns: true
}

const getInput = (inFile: string): csvParse.Parser => {
  const inStream = fs.createReadStream(inFile)
  const parse = csvParse(OPTIONS)
  return inStream.pipe(parse)
}

const process = async (inFile: string, out: string) => {
    if (!await base.Utils.isFile(inFile)) {
      throw new Error(`Input ${inFile} file doesn't exists`)
    }

  const inStream = getInput(inFile)
  const outStream = fs.createWriteStream(out)
  const headers = await getHeaders(inFile)

  const stringifier = stringify({
    delimiter: ',',
    header: true,
    columns: headers
  })
  const transform = streamTransform(transformRecord)

  inStream
    .pipe(transform)
    .pipe(stringifier)
    .pipe(outStream)

  await new Promise(fulfill => outStream.on("finish", fulfill));

  outStream.close()
}

const getHeaders = async (file: string): Promise<string[]> => {
  const processor = getInput(file)
  const headers: Array<any> = Array()
  processor.on("data", (record: any) => {
    transformRecord(record)
    headers.push(_.keys(record))
  })
  await new Promise(fulfill => processor.on("finish", fulfill));

  return _.uniq(_.flatten(headers))
}

const isHeader = (line: string) => {
  return _.endsWith(line, ':')
}

const parseItems = (items: string): Map<string, string> => {
  const res = new Map<string, string>()
  let currentItem: Array<string> = Array(),
    currentHeader: string | undefined = undefined,
    inString: Boolean = false
  const lines = items.split('\n')

  _.each(lines, (line: string) => {
    if (_.startsWith(line, "'")) {
      inString = true
    }
    if (_.endsWith(line, "'")) {
      inString = false
    }
    if (!inString && isHeader(line)) {
      if (currentHeader) {
        res.set(currentHeader, currentItem.join('\n'))
        currentItem = Array()
      }
      currentHeader = line
    } else {
      currentItem.push(line)
    }
  })
  if (!_.isUndefined(currentHeader)) {
    res.set(currentHeader, currentItem.join('\n'))
  }
  return res
}

const transformArray = (record: any, items: string, prefix = ""): void => {
  if (_.startsWith(items, '"')) {
    items = items.slice(1,-1);
  }
  const map = parseItems(items)
  map.forEach((value: string, key: string) => {
    record[`${prefix}_${key}`] = value
  })
}

const transformRecord = (record: any): any => {
  const { answers, attempts } = record

  transformArray(record, answers, 'answers')
  transformArray(record, attempts, 'attempts')

  return record
}

export const CodioCSV = { process }
export default CodioCSV