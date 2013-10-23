exports.findById = function (res, fileIndex, fileType, thumbnail, northUp) {
  db.collection(mongoCollect, function (err, collection) {
    collection.find({
      fileIndex: parseInt(fileIndex, 10),
      fileType: fileType,
      thumbnail: thumbnail,
      northUp: northUp
    }).toArray(function (err, item) {
      if ((item[0] === undefined) || !item) {
        if (checkForFolder()) {
          transcodeFile(res, fileIndex, fileType, thumbnail, northUp);
        }
      } else {
        try {
          if (fs.existsSync(item[0].imagePath)) {
            sendToClient(res, item[0].imagePath);
          } else if (checkForFolder()) {
            transcodeFile(res, fileIndex, fileType, thumbnail, northUp);
          }
        } catch (e) {
          console.log("findById error: " + e.message);
        }
      }
    });
  });
};

//if no db then this is needed
exports.transcodeFile = function (res, fileIndex, fileType, thumbnail, northUp) {
  transcodeFile(res, fileIndex, fileType, thumbnail, northUp);
};

function transcodeFile(res, fileIndex, fileType, thumbnail, northUp) {
  var stagedFile = null,
    imagePath = null;

  try {
    queryEngine.queryForFiles(res, { fileIndex: fileIndex }, function (data) {
      if (data[0].usageType === "ATTACHMENT" || data[0].usageType === "VIDEO") {
        // Send the raw file, no matter what the actual format is.
        imagePath = fileClient.getFile(res, data[0].filePath);
        path.normalize(imagePath);
        res.type(mime.lookup(imagePath));
        res.setHeader("Content-disposition", "attachment; filename=" + path.basename(imagePath));
        sendToClient(res, imagePath);
        return;
      }
      if (data[0].usageType !== "IMAGE") {
        northUp = false;
        thumbnail = false;
      }
      res.setHeader("Content-disposition", "attachment; filename=file" + fileIndex + (northUp ? "_nup" : "") + (thumbnail ? "_thmb" : "") + "." + fileType);
      stagedFile = transcodeLogic(res, fileType, thumbnail, data);
      // Transcode the file to JPEG or PNG.
      transcoder.transcode(stagedFile, fileType, thumbnail, northUp, function (data) {
        imagePath = data.filePath;
        path.normalize(imagePath);
        res.type(mime.lookup(imagePath));
        sendToClient(res, imagePath);
        if (db && (db !== undefined)) {
          cacheToDb(fileIndex, fileType, thumbnail, northUp, imagePath);
        }
        exports.cleanUpCacheMinor(imagePath, stagedFile);
      });
    }); //end queryEngine.queryForFiles
  } catch (e) {
    console.log("error: " + e.message);
  }
}

function sendToClient(res, imagePath) {
  var img = fs.readFileSync(imagePath);
  res.writeHead(200, imagePath);
  res.end(img, "binary");
}

function cacheToDb(fileIndex, fileType, thumbnail, northUp, imagePath) {
  var today = new Date(),
    removeOn = new Date(),
    dateMillis = today.getTime(),
    ic = [{
      fileIndex: parseInt(fileIndex, 10),
      fileType: fileType,
      thumbnail: thumbnail,
      northUp: northUp,
      imagePath: imagePath,
      removeOn: removeOn
    }];

  removeOn.setTime(dateMillis + daysToMs(cacheDaysLimit));
  db.collection(mongoCollect, function (err, collection) {
    collection.insert(ic, { safe: true }, function (err, result) {});
  });
}

function checkForFolder() {
  //if folder "public/files" doesn"t exist then create it
  fs.stat(filesPath, function (error, stats) {
    if (error) {
      fs.mkdir(filesPath, function (e) {
        if (!e || (e && e.code === "EEXIST")) { return true; } // File was created.
        console.log(filesPath + " could not be created " + e);
        return false;
      });
      return false;
    }
    return true;
  });
  return true;
}

function transcodeLogic(res, fileType, thumbnail, data) {
  var sFile = "",
    splitPath = data[0].filePath.split("/"),
    newPath = "",
    i;

  if (fileType === "ntf" || fileType === "nitf" || thumbnail === false || data[0].usageType !== "IMAGE") {
    sFile = fileClient.getFile(res, data[0].filePath);
  } else {
    for (i = 0; i < splitPath.length; i++) {
      if (i < (splitPath.length - 1)) {
        newPath = newPath + splitPath[i] + "/";
      } else {
        newPath = newPath + data[0].imageFileData.quickFilePath;
      }
    }
    sFile = fileClient.getFile(res, newPath);
  } //end if/else
  return sFile;
}

function daysToMs(days) {
  return days * 24 * 60 * 60 * 1000;
}

function deleteDocument(sync) {
  if (!isReadyMongoDb) { return; }
  //delete from database
  db.collection(mongoCollect, function (err, collection) {
    collection.remove({"fileIndex": sync.fileIndex}, function (err, removed) {
      deleteFile(sync.imagePath);
      console.log(sync.fileIndex + " was removed from the database");
    });
  });
}

function deleteFile(filePath) {
  if (!filePath || (filePath === undefined)) { return; }

  fs.stat(filePath, function (error, stats) {
    if (error) {
      return false;
    }  // File exists, delete it.
    fs.unlink(filePath, function (e) {
      if (!e || (e && e.code === "EEXIST")) {
        // File was deleted.
        updateDirSize(filePath);
        console.log(filePath + " was deleted");
        return true;
      }
      return false;
    });
  });
}

function createCacheInfoArray() {
  var fullPath = "",
    normalizedPath = "",
    files = fs.readdirSync(filesPath),
    i;

  if (files) {
    dirSize = 0;
    cacheFileInfoName = [];
    cacheFileInfoSize = [];
    try {
      for (i = 0; i < files.length; i++) {
        fullPath = path.join(filesPath, files[i]);
        normalizedPath = path.normalize(fullPath);
        cacheFileInfoSize[i] = getFileStats(normalizedPath);
        cacheFileInfoName[i] = normalizedPath;
      }
    } catch (e) {
      console.log("error = " + e);
    }
  }
  if (cacheMajor) { deleteRawFiles(); }
}

function deleteRawFiles() {
  var parts = "",
    fullPath = "",
    normalizedPath = "",
    i;

  fs.readdir(filesPath, function (err, allFiles) {
    if (err) {
      console.log("fs.readdir " + err);
    } else {
      for (i = 0; i < allFiles.length; i++) {
        parts = path.extname(allFiles[i]);
        fullPath = path.join(filesPath, allFiles[i]);
        normalizedPath = path.normalize(fullPath);

        if (parts === ".raw") {
          updateDirSize(normalizedPath);
          deleteFile(normalizedPath);
        }
      }
      if (cacheMajor) {
        deleteFullRes();
      } else {
        if (dirSize > (dirSizeAllowable * antiThrashFactor)) { // Too much space on disk used.
          getDirSize();
        }
      }
    }
  });
}

function deleteFullRes() {
  if (!isReadyMongoDb) { return; }

  db.collection(mongoCollect, function (err, collection) {
    collection.remove({ thumbnail: false }, function (err, result) {
      if (err) {
        console.log("deleteFullRes " + err);
      }
      if (result) {
        console.log(result + " full res files in cache db deleted");
      }
      deleteOutDatedCache();
    });
  });
}

function deleteOutDatedCache() {
  if (!isReadyMongoDb) { return; }

  db.collection(mongoCollect, function (err, collection) {
    collection.find({ removeOn: { $lte: new Date() }}).toArray(function (err, old) {
      if (err) {
        console.log("remove outDatedCache " + err);
      }
      if (old.length > 0) {
        console.log("deleteOutDatedCache deleted documents = " + old.length);
      }
      getDirSize();
    });
  });
}

function getDirSize() {
  var fullPath = "",
    normalizedPath = "",
    i,
    files = fs.readdirSync(filesPath);

  if (files) {
    dirSize = 0;
    cacheFileInfoName = [];
    cacheFileInfoSize = [];
    try {
      for (i = 0; i < files.length; i++) {
        fullPath = path.join(filesPath, files[i]);
        normalizedPath = path.normalize(fullPath);
        cacheFileInfoSize[i] = getFileStats(normalizedPath);
        cacheFileInfoName[i] = normalizedPath;
      }
    } catch (e) {
      console.log("error = " + e);
    }
  } else {
    console.log("in getDirSize no files found");
  }
  if (cacheMajor) { exports.syncDatabase(); }
}

function getFileStats(file) {
  var numb = 0;
  if (fs.existsSync(file)) {
    numb = parseInt(fs.statSync(file).size, 10);
    dirSize = dirSize + numb;
    if (dirSize > (dirSizeAllowable * antiThrashFactor)) { // Too much space on disk used.
      updateDirSize(file);
      deleteFile(file);
    }
    return numb;
  }
}

exports.syncDatabase = function (callback) {
  if (!isReadyMongoDb) { return; }
  //check for db entries that don"t have images in transcode directory
  var hasImage = false,
    dbFileName = "",
    imageFileName = "",
    hasDbEntry = false,
    imageType = "",
    allFiles = null,
    fullPath = "",
    normalizedPath = "",
    s,
    i,
    z,
    h;

  allFiles = fs.readdirSync(filesPath);
  //test if db entry has a valid image
  db.collection(mongoCollect, function (err, collection) {
    collection.find().toArray(function (err, sync) {
      if (sync && (sync !== undefined) && allFiles) {
        for (i = 0; i < sync.length; i++) {
          hasImage = false;
          dbFileName = path.basename(sync[i].imagePath);
          for (z = 0; z < allFiles.length; z++) {
            imageFileName = path.basename(allFiles[z]);
            if (dbFileName === imageFileName) {
              hasImage = true;
              break;
            }
          }
          if (!hasImage) { deleteDocument(sync[i]); }
        }

        //test if image has valid db entry
        for (s = 0; s < allFiles.length; s++) {
          hasDbEntry = false;
          imageFileName = path.basename(allFiles[s]);
          imageType = path.extname(imageFileName);
          if (imageType[0] === ".") { imageType = imageType.substring(1); }
          for (h = 0; h < sync.length; h++) {
            dbFileName = path.basename(sync[h].imagePath);
            if (dbFileName === imageFileName) {
              hasDbEntry = true;
              break;
            }
          }
          if (!hasDbEntry) {
            fullPath = path.join(filesPath, allFiles[s]);
            normalizedPath = path.normalize(fullPath);
            updateDirSize(normalizedPath);
            deleteFile(normalizedPath);
          }
        } // end for loop
      } //end if
    }); //end collection.find
  }); //end db.collection
};

function updateDirSize(file) {
  if (!cacheFileInfoName || !cacheFileInfoSize) { return; }
  dirSize = 0;
  var t;
  //console.log("in updateDirSize file = " + file);
  for (t = 0; t < cacheFileInfoName.length; t++) {
    if (path.basename(cacheFileInfoName[t]) === path.basename(file)) {
      if (!dirSize || (dirSize === undefined)) { dirSize = 0; }
      //console.log("cacheFileInfoName[" + t + "] = " + cacheFileInfoName[t] + " cacheFileInfoSize[" + t + "] = " + cacheFileInfoSize[t]);
      dirSize = dirSize - parseInt(cacheFileInfoSize[t], 10);
      cacheFileInfoName.splice(t, 1);
      cacheFileInfoSize.splice(t, 1);
    } else {
      dirSize = dirSize + parseInt(cacheFileInfoSize[t], 10);
    }
  }
}

exports.cleanUpCacheMajor = function () {
  //remove any out dated cache files
  cacheMajor = true;
  createCacheInfoArray();
  //order of functions
  /*
   createCacheInfoArray
   deleteRawFiles
   deleteFullRes
   deleteOutDatedCache
   getDirSize
   exports.syncDatabase
   */
};

exports.cleanUpCacheMinor = function (imagePath, stagedFile) {
  //remove files only if cache is too big
  cacheMajor = false;
  getFileStats(stagedFile);
  getFileStats(imagePath);
  if (dirSize > (dirSizeAllowable * antiThrashFactor)) { // Too much space on disk used.
    deleteRawFiles();
  }
};
